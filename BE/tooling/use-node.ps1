$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$nodeVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '.node-version') -Raw).Trim()
$runtimeRoot = Join-Path $projectRoot 'BE\.local'
$runtimeDirectory = Join-Path $runtimeRoot "node-v$nodeVersion-win-x64"
$nodeExecutable = Join-Path $runtimeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $archiveName = "node-v$nodeVersion-win-x64.zip"
    $archivePath = Join-Path $runtimeRoot $archiveName
    $releaseUrl = "https://nodejs.org/dist/v$nodeVersion"
    try {
        Invoke-WebRequest "$releaseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
        $checksumText = (Invoke-WebRequest "$releaseUrl/SHASUMS256.txt" -UseBasicParsing).Content
        $checksumLine = $checksumText -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") }
        if (@($checksumLine).Count -ne 1) { throw 'Cannot identify official Node checksum.' }
        $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
        $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
        if ($actualHash -ne $expectedHash) { throw 'Node archive checksum mismatch.' }
        Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot
    } finally {
        if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
    }
}
$env:Path = "$runtimeDirectory;$env:Path"
Write-Output "Project Node $(& $nodeExecutable --version) active in this PowerShell session."
