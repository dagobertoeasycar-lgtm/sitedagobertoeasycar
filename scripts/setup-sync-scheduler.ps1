# Setup 10-minute auto-sync via Windows Task Scheduler
$taskName = "DagobertoEasycar-SyncEstoque"

# O caminho vem da propria localizacao do script (pasta acima de \scripts),
# em vez de ficar fixo. Antes estava "C:\sites\dagobertoeasycar", que nao existe
# nesta maquina — o projeto mora em D:\sitedagobertoeasycar\_envio_github\repo.
$sitePath = Split-Path -Parent $PSScriptRoot
Write-Host "Projeto detectado em: $sitePath" -ForegroundColor Cyan
$envFile  = Join-Path $sitePath ".env.production"
# Motor multi-parceiro. Rodar da VM, e nao do GitHub Actions, resolve o HTTP 403:
# Justo Car e Now Car estao atras de Cloudflare, que bloqueia as faixas de IP dos
# runners do GitHub. De um IP comum as mesmas URLs respondem 200.
$script   = Join-Path $sitePath "scripts\sync-partners.mjs"
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
# 15 minutos de limite: o Now Car nao tem API e precisa visitar cada anuncio,
# o que levou 42s na medicao com 53 carros. Com 5 parceiros sobra folga.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Sync veiculos do easycar a cada 10 minutos" -User "SYSTEM" -RunLevel Highest

Write-Host "Task Scheduler '$taskName' criado com sucesso! Sync a cada 10 minutos." -ForegroundColor Green
Write-Host "Log em: $logFile"

# Run once immediately
Start-ScheduledTask -TaskName $taskName
Write-Host "Primeira execução iniciada." -ForegroundColor Cyan
