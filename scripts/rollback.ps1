param([Parameter(Mandatory = $true)][ValidatePattern("^[0-9a-fA-F]{7,40}$")][string]$Commit)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot "backup.ps1")
git -C $root cat-file -e "$Commit^{commit}"
git -C $root checkout --detach $Commit
corepack pnpm --dir $root install --frozen-lockfile
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
if (-not $healthy) { throw "Rollback nao ficou saudavel em 180 segundos" }
