$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataPath = Join-Path $appRoot 'data'
$authPath = Join-Path $dataPath 'auth.json'
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
$env:DATA_DIR = $dataPath
if (-not $env:PORT) { $env:PORT = '8080' }
if (-not (Test-Path $authPath)) {
    do {
        $securePassword = Read-Host 'Tao mat khau admin moi (it nhat 12 ky tu)' -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try { $env:NETWATCH_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
        if ($env:NETWATCH_PASSWORD.Length -lt 12) { Write-Host 'Mat khau can it nhat 12 ky tu.' -ForegroundColor Yellow }
    } while ($env:NETWATCH_PASSWORD.Length -lt 12)
}
Push-Location $appRoot
try {
    Write-Host "NetWatch dang chay. Mo http://localhost:$env:PORT" -ForegroundColor Cyan
    Write-Host 'Nhan Ctrl+C de dung. Thu muc data se duoc giu khi cap nhat.'
    & (Join-Path $appRoot 'node.exe') (Join-Path $appRoot 'dist/server.mjs')
    exit $LASTEXITCODE
}
finally {
    $env:NETWATCH_PASSWORD = $null
    Pop-Location
}
