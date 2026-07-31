param([switch]$RequireHttps)
$ErrorActionPreference = "Continue"
$logFile = "C:\Logs\DagobertoEasycar\healthcheck.log"
$stateFile = "C:\Logs\DagobertoEasycar\healthcheck-state.log"
$serviceName = "DagobertoEasycarApp"
$failures = @()
function Set-HealthState([string]$state) { "$(Get-Date -Format o) $state" | Set-Content -LiteralPath $stateFile -Encoding UTF8 }
Set-HealthState "START"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service -or $service.Status -ne "Running") { $failures += "serviço" }
Set-HealthState "SERVICE"
$ports = @(80, 3100)
if ($RequireHttps) { $ports += 443 }
function Test-LocalTcpPort([int]$port, [int]$timeoutMs = 3000) {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne($timeoutMs)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}
foreach ($port in $ports) { if (-not (Test-LocalTcpPort $port)) { $failures += "porta-$port" } }
Set-HealthState "PORTS"
try {
    $healthText = & curl.exe --silent --show-error --fail --max-time 8 "http://127.0.0.1:3100/api/health" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "curl falhou" }
    $health = $healthText | ConvertFrom-Json
    if ($health.status -ne "ok" -or $health.database -ne "ok") { $failures += "health-api" }
} catch { $failures += "health-api" }
Set-HealthState "HTTP"
$disk = New-Object IO.DriveInfo("C")
if ($disk.AvailableFreeSpace -lt 10GB) { $failures += "disco" }
Set-HealthState "DISK"
if ($failures.Count) {
    "$(Get-Date -Format o) FALHA $($failures -join ',')" | Add-Content -LiteralPath $logFile -Encoding UTF8
    exit 1
}
"$(Get-Date -Format o) OK" | Add-Content -LiteralPath $logFile -Encoding UTF8
Set-HealthState "OK"
exit 0
