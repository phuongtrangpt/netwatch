param([string]$Package,[string]$Archive)
$ErrorActionPreference='Stop'
$fixture=Join-Path $env:RUNNER_TEMP ('NetWatch '+[char]0x0111+[char]0x00E0+' with spaces')
Copy-Item -LiteralPath $Package -Destination $fixture -Recurse
$data=Join-Path $fixture 'data';New-Item -ItemType Directory -Force -Path $data | Out-Null
$target=(Get-Content -LiteralPath (Join-Path $Package 'package.json') -Raw | ConvertFrom-Json).version
$env:DATA_DIR=$data;$env:NETWATCH_PASSWORD='windows-update-test-password';$env:PORT='18091'
$node=Join-Path $fixture 'node.exe';$helper=Join-Path $Package 'update-netwatch.ps1'
$updates=Join-Path $data 'updates';New-Item -ItemType Directory -Force -Path $updates | Out-Null
$mockPath=Join-Path $updates 'release-mock.mjs'
$mockUri=([uri]$mockPath).AbsoluteUri
$assetName="netwatch-windows-x64-$target.zip"
$assetUrl="https://github.com/phuongtrangpt/netwatch/releases/download/v$target/$assetName"
$release=@{tag_name="v$target";draft=$false;prerelease=$false;body='Windows update integration fixture';assets=@(@{name=$assetName;state='uploaded';size=(Get-Item -LiteralPath $Archive).Length;digest=('sha256:'+(Get-FileHash -LiteralPath $Archive).Hash.ToLowerInvariant());browser_download_url=$assetUrl})}
$mockCode=@"
import {readFileSync} from 'node:fs';
const archive=$($Archive | ConvertTo-Json -Compress), release=$($release | ConvertTo-Json -Depth 8 -Compress), assetUrl=$($assetUrl | ConvertTo-Json -Compress);
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{if(String(url)==='https://github.com/phuongtrangpt/netwatch/releases/latest/download/netwatch-update.json')return new Response(JSON.stringify(release),{status:200});if(String(url)==='https://api.github.com/repos/phuongtrangpt/netwatch/releases/latest')return new Response('{}',{status:403});if(String(url)===assetUrl)return new Response(readFileSync(archive),{status:200});return original(url,options);};
"@
[IO.File]::WriteAllText($mockPath,$mockCode,(New-Object Text.UTF8Encoding $false))

function Write-JSON($path,$value){[IO.File]::WriteAllText($path,($value|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding $false))}
function Set-OldVersion{$p=Get-Content -LiteralPath (Join-Path $fixture 'package.json') -Raw | ConvertFrom-Json;$p.version='0.0.1';Write-JSON (Join-Path $fixture 'package.json') $p}
function Start-Old{Start-Process -FilePath $node -ArgumentList "--import `"$mockUri`" `"$(Join-Path $fixture 'dist/server.mjs')`"" -WorkingDirectory $fixture -PassThru -NoNewWindow}
function Wait-Health($version){for($i=0;$i -lt 120;$i++){try{$r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:18091/healthz' -TimeoutSec 2;if($r.StatusCode -eq 200 -and $r.Headers['X-NetWatch-Version'] -eq $version){return}}catch{};Start-Sleep -Milliseconds 500};throw "Health check failed for version $version"}
function Stop-Fixture{Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $node} | Stop-Process -Force -ErrorAction SilentlyContinue}
function Start-Helper($request,[switch]$ValidateOnly){$args=@('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$helper`"",'-RequestPath',"`"$request`"");if($ValidateOnly){$args+='-ValidateOnly'};Start-Process -FilePath 'powershell.exe' -ArgumentList $args -PassThru -NoNewWindow}
function New-Request($zip,$pidValue,$hashOverride=''){
 $job=Join-Path $updates ([guid]::NewGuid().ToString());New-Item -ItemType Directory -Force -Path $job | Out-Null
 $hash=if($hashOverride){$hashOverride}else{(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()}
 $manifest=Join-Path $job 'request.json';Write-JSON $manifest @{appRoot=$fixture;dataDir=$data;zipPath=$zip;sha256=$hash;targetVersion=$target;parentPid=$pidValue;port=18091};return $manifest
}
function Wait-Ready($request){$ready=Join-Path (Split-Path -Parent $request) 'ready';for($i=0;$i -lt 300;$i++){if(Test-Path -LiteralPath $ready){return};Start-Sleep -Milliseconds 500};throw 'Updater did not validate its package'}
function Wait-Status($phase){for($i=0;$i -lt 360;$i++){try{$s=Get-Content -LiteralPath (Join-Path $updates 'status.json') -Raw -Encoding UTF8 | ConvertFrom-Json;if($s.phase -eq $phase){return}}catch{};Start-Sleep -Milliseconds 500};throw "Updater did not reach $phase. Last status: $($s | ConvertTo-Json -Compress)"}
try{
 Set-OldVersion;$old=Start-Old;Wait-Health '0.0.1'
 Set-Content -LiteralPath (Join-Path $data 'sentinel.txt') -Value 'preserve-me'
 $authHash=(Get-FileHash -LiteralPath (Join-Path $data 'auth.json')).Hash
 # Wrong SHA is rejected before changing the running application.
 $request=New-Request $Archive $old.Id ('0'*64);$check=Start-Helper $request -ValidateOnly;$check.WaitForExit();if($check.ExitCode -eq 0){throw 'Wrong SHA was accepted'};Wait-Health '0.0.1'
 # Path traversal is rejected without extracting any external file.
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $evil=Join-Path $updates 'traversal.zip';$z=[IO.Compression.ZipFile]::Open($evil,[IO.Compression.ZipArchiveMode]::Create);$entry=$z.CreateEntry('../escaped.txt');$w=New-Object IO.StreamWriter($entry.Open());$w.Write('bad');$w.Dispose();$z.Dispose()
 $request=New-Request $evil $old.Id;$check=Start-Helper $request -ValidateOnly;$check.WaitForExit();if($check.ExitCode -eq 0){throw 'Unsafe archive was accepted'};Wait-Health '0.0.1'
 # Actual swap of the packaged app, using Windows PowerShell 5.1.
 $oldSession=New-Object Microsoft.PowerShell.Commands.WebRequestSession
 Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:18091/login' -Method POST -Headers @{Origin='http://127.0.0.1:18091'} -Body @{username='admin';password='windows-update-test-password'} -WebSession $oldSession | Out-Null
 $updateInfo=Invoke-RestMethod -Uri 'http://127.0.0.1:18091/api/system' -WebSession $oldSession
 if(-not $updateInfo.available -or -not $updateInfo.canInstall){throw 'Windows web update was not offered'}
 $accepted=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:18091/api/system' -Method POST -ContentType 'application/json' -Headers @{Origin='http://127.0.0.1:18091'} -Body (@{action='install';version=$target}|ConvertTo-Json) -WebSession $oldSession
 if($accepted.StatusCode -ne 202){throw 'Windows web update was not accepted'}
 Wait-Status 'completed';Wait-Health $target

 if((Get-FileHash -LiteralPath (Join-Path $data 'auth.json')).Hash -ne $authHash){throw 'Authentication file changed'}
 if((Get-Content -LiteralPath (Join-Path $data 'sentinel.txt') -Raw).Trim() -ne 'preserve-me'){throw 'Data was lost'}
 $session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
 Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:18091/login' -Method POST -Headers @{Origin='http://127.0.0.1:18091'} -Body @{username='admin';password='windows-update-test-password'} -WebSession $session | Out-Null
 $info=Invoke-RestMethod -Uri 'http://127.0.0.1:18091/api/session' -WebSession $session;if($info.username -ne 'admin'){throw 'Login after update failed'}
 Stop-Fixture;Start-Sleep -Milliseconds 500
 # Failure before replacing files must restart the untouched old application.
 Set-OldVersion;$env:NETWATCH_PASSWORD='windows-update-test-password';$old=Start-Old;Wait-Health '0.0.1'
 $request=New-Request $Archive $old.Id;Set-Content -LiteralPath (Join-Path (Split-Path -Parent $request) 'backup') -Value 'block backup directory'
 $preapply=Start-Helper $request;Wait-Ready $request;Stop-Process -Id $old.Id -Force;Wait-Status 'failed';Wait-Health '0.0.1';Stop-Fixture;$preapply.WaitForExit(10000) | Out-Null
 # A validated archive whose server fails startup must restore both app and data.
 $bad=Join-Path $updates 'bad-package';New-Item -ItemType Directory -Force -Path $bad | Out-Null
 foreach($item in @('node.exe','package.json','start-netwatch.ps1','Start-NetWatch.bat','README.txt','update-netwatch.ps1')){Copy-Item -LiteralPath (Join-Path $Package $item) -Destination $bad}
 foreach($dir in @('dist','drizzle','node_modules')){New-Item -ItemType Directory -Force -Path (Join-Path $bad $dir) | Out-Null;Set-Content -LiteralPath (Join-Path $bad "$dir/fixture.txt") -Value 'fixture'}
 Set-Content -LiteralPath (Join-Path $bad 'dist/server.mjs') -Encoding ASCII -Value "import {writeFileSync} from 'node:fs';import {join} from 'node:path';writeFileSync(join(process.env.DATA_DIR,'sentinel.txt'),'changed-by-broken-update');throw new Error('intentional update test failure');"
 $badArchive=Join-Path $updates 'bad-package.zip';Compress-Archive -Path (Join-Path $bad '*') -DestinationPath $badArchive
 Set-OldVersion;$env:NETWATCH_PASSWORD='windows-update-test-password';$old=Start-Old;Wait-Health '0.0.1'
 $request=New-Request $badArchive $old.Id;$rollback=Start-Helper $request;Wait-Ready $request;Stop-Process -Id $old.Id -Force;Wait-Status 'rolled_back';Wait-Health '0.0.1'
 if((Get-FileHash -LiteralPath (Join-Path $data 'auth.json')).Hash -ne $authHash){throw 'Rollback did not restore authentication'}
 if((Get-Content -LiteralPath (Join-Path $data 'sentinel.txt') -Raw).Trim() -ne 'preserve-me'){throw 'Rollback did not restore data'}
 Write-Host 'Windows updater: SHA, archive paths, successful web update, login, pre-apply recovery and rollback passed.'
}catch{
 Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('node.exe','powershell.exe')} | Select-Object ProcessId,ParentProcessId,CommandLine | Format-List | Out-String | Write-Host
 Get-ChildItem -LiteralPath $updates -Recurse -File | Where-Object {$_.Extension -in @('.log','.json') -and $_.FullName -notmatch '[\\/]stage[\\/]|[\\/]backup[\\/]'} | Select-Object FullName,Length | Format-Table -AutoSize | Out-String -Width 300 | Write-Host
 Get-ChildItem -LiteralPath $updates -Filter '*.log' -Recurse | ForEach-Object {Write-Host $_.FullName;Get-Content -LiteralPath $_.FullName -Tail 30}
 Get-ChildItem -LiteralPath $updates -Filter 'request.json' -Recurse | ForEach-Object {Write-Host (Get-Content -LiteralPath $_.FullName -Raw)}
 throw
}finally{Stop-Fixture}
