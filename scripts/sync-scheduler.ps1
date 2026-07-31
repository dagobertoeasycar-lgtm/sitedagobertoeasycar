<#
.SYNOPSIS
  Agenda a sincronização do estoque EasyCar a cada 5 minutos via Task Scheduler do Windows.
.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\sync-scheduler.ps1
#>

$ErrorActionPreference = "Stop"
$TaskName = "DagobertoEasycar-SyncEstoque"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Carrega variáveis do .env se existir
$EnvFile = Join-Path $ProjectDir ".env"
$DbUrl = $env:DATABASE_URL
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^DATABASE_URL=(.+)$') { $DbUrl = $Matches[1] }
    }
}
if (-not $DbUrl) { throw "DATABASE_URL não encontrada no .env ou ambiente" }

# Script que será executado
$SyncScript = Join-Path $ProjectDir "scripts\sync-easycar.mjs"
$LogFile = Join-Path $ProjectDir "logs\sync.log"

# Criar pasta de logs
$LogDir = Join-Path $ProjectDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# Comando
$Action = New-ScheduledTaskAction `
    -Execute "node" `
    -Argument "`"$SyncScript`"" `
    -WorkingDirectory $ProjectDir

# Trigger: a cada 5 minutos, indefinidamente
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

# Configurações
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

# Remover tarefa existente se houver
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Criar tarefa
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Sincroniza estoque da EasyCar Veiculos a cada 5 minutos" `
    -RunLevel Highest

Write-Host "Tarefa '$TaskName' criada com sucesso!"
Write-Host "Intervalo: 5 minutos"
Write-Host "Script: $SyncScript"
Write-Host ""
Write-Host "Para verificar: Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Para remover:   Unregister-ScheduledTask -TaskName '$TaskName'"
