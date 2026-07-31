$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $root ".env.production"
if (-not (Test-Path -LiteralPath $environmentFile)) { throw ".env.production não encontrado" }

Get-Content -LiteralPath $environmentFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
}

[Environment]::SetEnvironmentVariable("HOSTNAME", "127.0.0.1", "Process")
[Environment]::SetEnvironmentVariable("PORT", "3100", "Process")
$standaloneRoot = Join-Path $root ".next\standalone"
$server = Join-Path $standaloneRoot "server.js"
if (-not (Test-Path -LiteralPath $server)) { throw "Build standalone nao encontrado" }
Set-Location -LiteralPath $standaloneRoot
& "C:\Program Files\nodejs\node.exe" $server
exit $LASTEXITCODE
