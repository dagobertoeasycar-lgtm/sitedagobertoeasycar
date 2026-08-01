# Setup 10-minute auto-sync via Windows Task Scheduler
$taskName = "DagobertoEasycar-SyncEstoque"
$sitePath = "C:\sites\dagobertoeasycar"
$envFile  = Join-Path $sitePath ".env.production"
$script   = Join-Path $sitePath "scripts\sync-easycar.mjs"
$logFile  = Join-Path $sitePath "logs\sync.log"

# Ensure logs dir
New-Item -ItemType Directory -Force -Path (Join-Path $sitePath "logs") | Out-Null

# Build the action: load .env.production then run the sync
$cmd = @"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
`$envFile = '$envFile'
if (Test-Path `$envFile) {
  Get-Content `$envFile | ForEach-Object {
    if (`$_ -match '^([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable(`$matches[1].Trim(), `$matches[2].Trim(), 'Process')
    }
  }
}
Set-Location '$sitePath'
node '$script' >> '$logFile' 2>&1
"@

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -Command `"$cmd`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 9999)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Sync veiculos do easycar a cada 10 minutos" -User "SYSTEM" -RunLevel Highest

Write-Host "Task Scheduler '$taskName' criado com sucesso! Sync a cada 10 minutos." -ForegroundColor Green
Write-Host "Log em: $logFile"

# Run once immediately
Start-ScheduledTask -TaskName $taskName
Write-Host "Primeira execução iniciada." -ForegroundColor Cyan
