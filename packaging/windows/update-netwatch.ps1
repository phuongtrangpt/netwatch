param([Parameter(Mandatory=$true)][string]$RequestPath,[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$request=Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$appRoot=[IO.Path]::GetFullPath($request.appRoot)
$dataDir=[IO.Path]::GetFullPath($request.dataDir)
$job=Split-Path -Parent ([IO.Path]::GetFullPath($RequestPath))
$updates=Join-Path $dataDir 'updates'
$statusPath=Join-Path $updates 'status.json'
$stage=Join-Path $job 'stage'
$backup=Join-Path $job 'backup'
$items=@('dist','drizzle','node_modules','node.exe','package.json','start-netwatch.ps1','Start-NetWatch.bat','README.txt','update-netwatch.ps1')
$installed=@();$saved=@();$newProcess=$null;$changed=$false;$dataBackedUp=$false;$stopped=$false
function Set-UpdateStatus([string]$phase,[string]$message){
    New-Item -ItemType Directory -Force -Path $updates | Out-Null
    $json=@{phase=$phase;message=$message;targetVersion=$request.targetVersion;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json
    [IO.File]::WriteAllText($statusPath,$json,(New-Object Text.UTF8Encoding $false))
}
function Start-App {
    $node=Join-Path $appRoot 'node.exe'
    $server=Join-Path $appRoot 'dist/server.mjs'
    $env:DATA_DIR=$dataDir
    $env:PORT=[string]$request.port
    $env:NETWATCH_PASSWORD=$null
    Start-Process -FilePath $node -ArgumentList "`"$server`"" -WorkingDirectory $appRoot -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $job 'app.stdout.log') -RedirectStandardError (Join-Path $job 'app.stderr.log')
}
try {
    if(-not $job.StartsWith([IO.Path]::GetFullPath($updates)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Update request is outside its working directory.'}
    if($request.targetVersion -notmatch '^\d+\.\d+\.\d+$' -or $request.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update metadata.'}
    if([int]$request.port -lt 1 -or [int]$request.port -gt 65535){throw 'Invalid port.'}
    if((Get-FileHash -LiteralPath $request.zipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $request.sha256){throw 'SHA-256 verification failed.'}
    $zip=[IO.Compression.ZipFile]::OpenRead($request.zipPath)
    try {
        foreach($entry in $zip.Entries){
            $name=$entry.FullName.Replace('\','/')
            if($name.StartsWith('/') -or $name.Contains(':') -or ($name.Split('/') -contains '..')){throw 'Unsafe archive path.'}
            $top=$name.Split('/')[0]
            if($items -notcontains $top){throw "Unexpected package entry: $top"}
            $target=[IO.Path]::GetFullPath((Join-Path $stage $entry.FullName))
            if(-not $target.StartsWith([IO.Path]::GetFullPath($stage)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escapes the staging folder.'}
        }
    } finally {$zip.Dispose()}
    [IO.Compression.ZipFile]::ExtractToDirectory($request.zipPath,$stage)
    foreach($item in $items){if(-not(Test-Path -LiteralPath (Join-Path $stage $item))){throw "Package missing: $item"}}
    $package=Get-Content -LiteralPath (Join-Path $stage 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($package.version -ne $request.targetVersion){throw 'Package version does not match the selected release.'}
    if(-not(Test-Path -LiteralPath (Join-Path $stage 'dist/server.mjs'))){throw 'Server bundle missing.'}
    if($ValidateOnly){Write-Output 'Package validated';exit 0}
    Set-Content -LiteralPath (Join-Path $job 'ready') -Value 'ready'
    $old=Get-Process -Id ([int]$request.parentPid) -ErrorAction SilentlyContinue
    if($old -and -not $old.WaitForExit(120000)){throw 'Application did not stop. No files were changed.'}
    $stopped=$true
    Set-UpdateStatus 'applying' 'Dang sao luu du lieu va thay ban moi...'
    New-Item -ItemType Directory -Force -Path (Join-Path $backup 'app'),(Join-Path $backup 'data') | Out-Null
    # SQLite was checkpointed and closed by the server before this copy.
    Get-ChildItem -LiteralPath $dataDir -Force | Where-Object {$_.Name -ne 'updates'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $backup 'data') -Recurse -Force}
    $dataBackedUp=$true
    foreach($item in $items){
        $target=Join-Path $appRoot $item
        if(Test-Path -LiteralPath $target){Move-Item -LiteralPath $target -Destination (Join-Path $backup 'app');$saved+= $item}
        $changed=$true
        $installed+= $item
        Copy-Item -LiteralPath (Join-Path $stage $item) -Destination $appRoot -Recurse -Force
    }
    Set-UpdateStatus 'restarting' 'Dang khoi dong ban moi...'
    $newProcess=Start-App
    $healthy=$false
    for($i=0;$i -lt 90;$i++){
        if($newProcess.HasExited){break}
        try {
            $r=Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($request.port)/healthz" -TimeoutSec 2
            if($r.StatusCode -eq 200 -and $r.Headers['X-NetWatch-Version'] -eq $request.targetVersion){$healthy=$true;break}
        }catch{}
        Start-Sleep -Milliseconds 500
    }
    if(-not $healthy){throw 'New version failed its health check.'}
    Set-UpdateStatus 'completed' 'Cap nhat thanh cong. Du lieu va tai khoan da duoc giu nguyen.'
    Write-Host "NetWatch $($request.targetVersion) dang chay. Du lieu: $dataDir" -ForegroundColor Green
    Write-Host 'Giu cua so nay khi su dung. Nhan Ctrl+C de dung.'
    $newProcess.WaitForExit()
} catch {
    if($newProcess -and -not $newProcess.HasExited){Stop-Process -Id $newProcess.Id -Force -ErrorAction SilentlyContinue}
    try {
        if($changed){
            foreach($item in $items){if(Test-Path -LiteralPath (Join-Path $backup "app/$item")){Remove-Item -LiteralPath (Join-Path $appRoot $item) -Recurse -Force -ErrorAction SilentlyContinue;Move-Item -LiteralPath (Join-Path $backup "app/$item") -Destination $appRoot}else{if($installed -contains $item){Remove-Item -LiteralPath (Join-Path $appRoot $item) -Recurse -Force -ErrorAction SilentlyContinue}}}
            if($dataBackedUp){Get-ChildItem -LiteralPath $dataDir -Force | Where-Object {$_.Name -ne 'updates'} | Remove-Item -Recurse -Force;Get-ChildItem -LiteralPath (Join-Path $backup 'data') -Force | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $dataDir -Recurse -Force}}
            $newProcess=Start-App
            Set-UpdateStatus 'rolled_back' 'Cap nhat loi; da phuc hoi ban cu va du lieu sao luu.'
            $newProcess.WaitForExit()
        }else{
            if($stopped){$newProcess=Start-App;Set-UpdateStatus 'failed' 'Khong the thay file; da khoi dong lai ban cu, du lieu khong thay doi.';$newProcess.WaitForExit()}
            else{Set-UpdateStatus 'failed' 'Khong the chuan bi cap nhat. Ban hien tai va du lieu khong thay doi.'}
        }
    }catch{Set-UpdateStatus 'failed' 'Cap nhat bi dung. Hay khoi dong lai NetWatch; ban sao luu nam trong data/updates.'}
    exit 1
}
