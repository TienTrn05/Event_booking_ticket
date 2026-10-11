$ErrorActionPreference = 'Stop'
$nodeVersion = (Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) '.node-version') -Raw).Trim()
# Shared nvm installation configured by the project owner; no project-local fallback.
$runtimeDirectory = Join-Path 'D:\NVM\installs' "v$nodeVersion"
$nodeExecutable = Join-Path $runtimeDirectory 'node.exe'
$npmExecutable = Join-Path $runtimeDirectory 'npm.cmd'
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    throw "Node $nodeVersion is missing from D:\NVM\installs. Install this version in the shared nvm root before running this helper."
}
$actualNode = (& $nodeExecutable --version).Trim()
if ($LASTEXITCODE -ne 0 -or $actualNode -ne "v$nodeVersion") { throw "Expected Node v$nodeVersion; selected runtime does not match." }
if (-not (Test-Path -LiteralPath $npmExecutable)) { throw 'The shared Node installation is missing npm.cmd.' }
$actualNpm = (& $npmExecutable --version).Trim()
if ($LASTEXITCODE -ne 0 -or $actualNpm -notmatch '^11\.') { throw 'This repository requires npm 11. Check the shared nvm Node installation.' }
$env:Path = "$runtimeDirectory;$env:Path"
Write-Output "Node $actualNode / npm $actualNpm from $runtimeDirectory active in this PowerShell session."
