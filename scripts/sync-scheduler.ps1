# Cria tarefa agendada para sync do estoque a cada 10 minutos.
#
# PREFIRA setup-sync-scheduler.ps1: ele confere Node, .env.production e o
# formato da DATABASE_URL antes de agendar. Este aqui e a versao enxuta.
#
# Execute o ARQUIVO, nao cole o conteudo no prompt: colado, $PSScriptRoot vem
# vazio e os caminhos saem nulos.
$taskName = "DagobertoEasycar-SyncEstoque"

$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$projectDir = $null
foreach ($c in @((Split-Path -Parent $base), $base, (Get-Location).Path) | Where-Object { $_ }) {
  if (Test-Path (Join-Path $c "scripts\sync-partners.mjs")) { $projectDir = $c; break }
}
if (-not $projectDir) {
  Write-Host "Nao encontrei a raiz do projeto. Rode: .\scripts\sync-scheduler.ps1" -ForegroundColor Red
  exit 1
}
Write-Host "Projeto detectado em: $projectDir" -ForegroundColor Cyan

# Script inline que carrega .env.production e roda o sync
$scriptBlock = @"
Set-Location '$projectDir'
Get-Content '.env.production' | ForEach-Object {
    if (`$_ -match '^([^#=]+)=(.*)$') {
        # Tira < > e aspas das pontas do valor (ver setup-sync-scheduler.ps1).
        `$valor = `$Matches[2].Trim().Trim([char[]]@('<', '>', '"', "'")).Trim()
        [System.Environment]::SetEnvironmentVariable(`$Matches[1].Trim(), `$valor, 'Process')
    }
}
node scripts/sync-partners.mjs >> logs/sync.log 2>&1
"@

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$scriptBlock`"" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew

# Remove existing task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Description "Sync estoque EasyCar a cada 10 minutos"

# Create logs folder
New-Item -ItemType Directory -Force -Path "$projectDir\logs" | Out-Null

Write-Host "Tarefa '$taskName' criada com sucesso! Sync a cada 10 minutos." -ForegroundColor Green
