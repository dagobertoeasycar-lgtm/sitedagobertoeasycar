param([switch]$RequireHttps)
$ErrorActionPreference = "Continue"
$logFile = "C:\Logs\DagobertoEasycar\healthcheck.log"
$serviceName = "DagobertoEasycarApp"
$failures = @()
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service -or $service.Status -ne "Running") { $failures += "serviço" }
$ports = @(80, 3100)
if ($RequireHttps) { $ports += 443 }
foreach ($port in $ports) { if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationLevel Quiet)) { $failures += "porta-$port" } }
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/health" -TimeoutSec 10
    if ($health.status -ne "ok" -or $health.database -ne "ok") { $failures += "health-api" }
} catch { $failures += "health-api" }
$disk = Get-PSDrive C
if ($disk.Free -lt 10GB) { $failures += "disco" }
if ($failures.Count) {
    "$(Get-Date -Format o) FALHA $($failures -join ',')" | Add-Content -LiteralPath $logFile -Encoding UTF8
    if ($failures -contains "serviço" -or $failures -contains "health-api") {
        Restart-Service -Name $serviceName -ErrorAction SilentlyContinue
    }
    exit 1
}
"$(Get-Date -Format o) OK" | Add-Content -LiteralPath $logFile -Encoding UTF8
exit 0
