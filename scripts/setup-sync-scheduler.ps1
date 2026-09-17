# =============================================================================
# setup-sync-scheduler.ps1
#
# Cria a tarefa agendada do Windows que sincroniza o estoque dos parceiros
# a cada 10 minutos, rodando desta maquina.
#
# POR QUE DESTA MAQUINA, e nao do GitHub Actions: Justo Car e Now Car estao
# atras de Cloudflare, que bloqueia as faixas de IP dos runners do GitHub e
# devolve HTTP 403. De um IP comum as mesmas URLs respondem 200.
#
# COMO EXECUTAR (importante):
#     powershell -ExecutionPolicy Bypass -File .\scripts\setup-sync-scheduler.ps1
# ou, no PowerShell, a partir da raiz do projeto:
#     .\scripts\setup-sync-scheduler.ps1
#
# NAO cole o conteudo deste arquivo no prompt. Colado, $PSScriptRoot vem vazio
# e os caminhos saem nulos. Este script agora detecta esse caso e aborta com
# aviso, em vez de criar uma tarefa quebrada.
# =============================================================================

$ErrorActionPreference = "Stop"
$taskName = "DagobertoEasycar-SyncEstoque"

# --- Descobrir a raiz do projeto ---------------------------------------------
# Funciona tanto rodando o arquivo (de \scripts) quanto colado na raiz.
$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$candidatos = @(
  (Split-Path -Parent $base),   # arquivo executado de dentro de \scripts
  $base,                        # colado/executado a partir da raiz
  (Get-Location).Path           # ultimo recurso
) | Where-Object { $_ }

$sitePath = $null
foreach ($c in $candidatos) {
  if (Test-Path (Join-Path $c "scripts\sync-partners.mjs")) { $sitePath = $c; break }
}

if (-not $sitePath) {
  Write-Host ""
  Write-Host "Nao encontrei a raiz do projeto." -ForegroundColor Red
  Write-Host "Rode assim, a partir da pasta do projeto:" -ForegroundColor Yellow
  Write-Host "    .\scripts\setup-sync-scheduler.ps1" -ForegroundColor Cyan
  Write-Host "Procurei por scripts\sync-partners.mjs em:"
  $candidatos | ForEach-Object { Write-Host "    $_" }
  exit 1
}

$envFile = Join-Path $sitePath ".env.production"
$script  = Join-Path $sitePath "scripts\sync-partners.mjs"
$logFile = Join-Path $sitePath "logs\sync.log"

Write-Host "Projeto detectado em: $sitePath" -ForegroundColor Cyan

# --- Conferencias antes de agendar -------------------------------------------
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) {
  Write-Host "Node nao encontrado no PATH. Instale o Node 24 ou superior." -ForegroundColor Red
  exit 1
}
Write-Host "Node: $((node -v))" -ForegroundColor DarkGray

if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "Falta o arquivo $envFile" -ForegroundColor Red
  Write-Host "Sem ele a tarefa roda mas falha, porque o sync precisa de DATABASE_URL." -ForegroundColor Yellow
  Write-Host "Crie o arquivo com uma linha, usando o mesmo valor que esta na Vercel:" -ForegroundColor Yellow
  Write-Host "    DATABASE_URL=postgresql://usuario:senha@servidor:5432/banco" -ForegroundColor Cyan
  Write-Host "Ele ja esta no .gitignore, entao nao vai para o repositorio." -ForegroundColor DarkGray
  exit 1
}

# Valida o formato antes de criar a tarefa: evita descobrir o erro so no log.
Write-Host "Conferindo a DATABASE_URL..." -ForegroundColor DarkGray
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
Push-Location $sitePath
& node "scripts\check-database-url.mjs"
$okDb = ($LASTEXITCODE -eq 0)
Pop-Location
if (-not $okDb) {
  Write-Host "Corrija a DATABASE_URL em $envFile e rode de novo." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path (Join-Path $sitePath "logs") | Out-Null

# --- Montar a acao ------------------------------------------------------------
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
node '$script' *>> '$logFile'
"@

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -Command `"$cmd`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 9999)

# 15 minutos de limite: o Now Car nao tem API e precisa visitar cada anuncio,
# o que levou 42s na medicao com 53 carros. Com 5 parceiros sobra folga.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "Sincroniza o estoque dos parceiros a cada 10 minutos" -User "SYSTEM" -RunLevel Highest | Out-Null

Write-Host ""
Write-Host "Tarefa '$taskName' criada. Sincroniza a cada 10 minutos." -ForegroundColor Green
Write-Host "Log em: $logFile"
Write-Host ""
Write-Host "Para acompanhar:" -ForegroundColor Cyan
Write-Host "    Get-Content '$logFile' -Tail 40 -Wait"
Write-Host "Para remover:" -ForegroundColor Cyan
Write-Host "    Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"

Start-ScheduledTask -TaskName $taskName
Write-Host ""
Write-Host "Primeira execucao iniciada." -ForegroundColor Cyan
