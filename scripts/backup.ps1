$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupRoot = "C:\Backups\DagobertoEasycar"
$environmentFile = Join-Path $root ".env.production"
$logFile = "C:\Logs\DagobertoEasycar\backup.log"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$destination = Join-Path $backupRoot "daily\DagobertoEasycar_$stamp"
New-Item -ItemType Directory -Path $destination -Force | Out-Null

$settings = @{}
Get-Content -LiteralPath $environmentFile | ForEach-Object {
    if ($_ -match "^([^#=]+)=(.*)$") { $settings[$matches[1].Trim()] = $matches[2].Trim() }
}
$database = [Uri]$settings["DATABASE_URL"]
$userInfo = $database.UserInfo.Split(":", 2)
$env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter pg_dump.exe -Recurse | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump não encontrado" }

& $pgDump.FullName --host $database.Host --port $database.Port --username $userInfo[0] --format custom --file (Join-Path $destination "database.dump") $database.AbsolutePath.TrimStart("/")
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou" }

$uploads = Join-Path $root "data\uploads"
$uploadItems = @(Get-ChildItem -LiteralPath $uploads -Force -ErrorAction SilentlyContinue)
if ($uploadItems.Count -gt 0) {
    Compress-Archive -Path (Join-Path $uploads "*") -DestinationPath (Join-Path $destination "uploads.zip") -CompressionLevel Optimal
}
$manifest = [ordered]@{ createdAt = (Get-Date).ToString("o"); version = (git -C $root rev-parse HEAD); hostname = $env:COMPUTERNAME; files = @() }
$manifest.files = @(Get-ChildItem -File -LiteralPath $destination | ForEach-Object { [ordered]@{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash } })
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination "manifest.json") -Encoding UTF8
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

$dailyRoot = [IO.Path]::GetFullPath((Join-Path $backupRoot "daily")).TrimEnd('\')
$expired = @(Get-ChildItem -LiteralPath $dailyRoot -Directory | Sort-Object CreationTime -Descending | Select-Object -Skip 7)
foreach ($item in $expired) {
    $resolved = [IO.Path]::GetFullPath($item.FullName)
    if (-not $resolved.StartsWith($dailyRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Retencao recusada fora da raiz de backup: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
"$(Get-Date -Format o) OK $destination" | Add-Content -LiteralPath $logFile -Encoding UTF8
