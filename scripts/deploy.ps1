param([string]$Branch = "main")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logFile = "C:\Logs\DagobertoEasycar\deploy.log"
$previous = git -C $root rev-parse HEAD
"$(Get-Date -Format o) início commit=$previous" | Add-Content -LiteralPath $logFile -Encoding UTF8
& (Join-Path $PSScriptRoot "backup.ps1")
git -C $root fetch origin $Branch
git -C $root checkout $Branch
git -C $root pull --ff-only origin $Branch
corepack pnpm --dir $root install --frozen-lockfile
corepack pnpm --dir $root db:migrate
corepack pnpm --dir $root build
$standaloneRoot = Join-Path $root ".next\standalone"
$standaloneStatic = Join-Path $standaloneRoot ".next\static"
$standalonePublic = Join-Path $standaloneRoot "public"
New-Item -ItemType Directory -Path $standaloneStatic, $standalonePublic -Force | Out-Null
Copy-Item -Path (Join-Path $root ".next\static\*") -Destination $standaloneStatic -Recurse -Force
Copy-Item -Path (Join-Path $root "public\*") -Destination $standalonePublic -Recurse -Force
Restart-Service DagobertoEasycarApp
$healthy = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 3
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/health" -TimeoutSec 5
        if ($health.status -eq "ok" -and $health.database -eq "ok") { $healthy = $true; break }
    } catch {}
}
if (-not $healthy) { throw "Aplicacao nao ficou saudavel em 180 segundos" }
"$(Get-Date -Format o) sucesso commit=$(git -C $root rev-parse HEAD)" | Add-Content -LiteralPath $logFile -Encoding UTF8
