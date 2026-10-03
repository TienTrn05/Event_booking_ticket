$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$envFile = Join-Path $appRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    # Modify only the DACL, without requesting ownership/SACL privileges.
    $currentGrant = '*' + $currentSid.Value + ':(F)'
    & icacls.exe $envFile /inheritance:r /grant:r $currentGrant '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect local environment file permissions.' }
    $allowedSids = @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')
    $accessRules = (Get-Acl -LiteralPath $envFile).GetAccessRules($true, $false, [System.Security.Principal.SecurityIdentifier])
    foreach ($accessRule in $accessRules) {
        if ($accessRule.AccessControlType -eq 'Allow' -and $accessRule.IdentityReference.Value -notin $allowedSids) {
            & icacls.exe $envFile /remove:g ('*' + $accessRule.IdentityReference.Value) | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not remove an unexpected environment file access grant.' }
        }
    }
}
Write-Output 'BE/.env permissions restricted to current user, SYSTEM and administrators.'
