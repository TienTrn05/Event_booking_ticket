$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($relativePath in @('BE\.env', 'Fe\.env')) {
    $envFile = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $envFile)) { continue }
    # Modify only the DACL, without requesting ownership/SACL privileges.
    $currentGrant = '*' + $currentSid.Value + ':(F)'
    & icacls.exe $envFile /inheritance:r /grant:r $currentGrant '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect local environment file permissions.' }
}
Write-Output 'Local .env permissions restricted to current user, SYSTEM and administrators.'
