# =============================================================================
# setup-sync-local.ps1
#
# Registra a tarefa agendada que roda sync-local-hourly.ps1 de hora em hora
# nesta maquina, cobrindo as lojas que bloqueiam IP de datacenter (Justo Car e
# Now Car). As demais lojas ja atualizam pela nuvem, no workflow
# .github/workflows/sync-estoque.yml.
#
# Executar:  .\scripts\setup-sync-local.ps1
# Remover:   Unregister-ScheduledTask -TaskName 'Autodrive-SyncEstoque-Local' -Confirm:$false
# =============================================================================

$ErrorActionPreference = "Stop"
$nome = "Autodrive-SyncEstoque-Local"

$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$projeto = $null
foreach ($c in @((Split-Path -Parent $base), $base, (Get-Location).Path) | Where-Object { $_ }) {
  if (Test-Path (Join-Path $c "scripts\sync-partners.mjs")) { $projeto = $c; break }
}
if (-not $projeto) {
  Write-Host "Nao encontrei a raiz do projeto. Rode o arquivo, nao cole o conteudo." -ForegroundColor Red
  exit 1
}

$script = Join-Path $projeto "scripts\sync-local-hourly.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`"" `
  -WorkingDirectory $projeto

# Comeca 37 minutos depois da hora cheia para nao cair junto do agendamento da
# nuvem, que roda aos 7 minutos.
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(37) -RepetitionInterval (New-TimeSpan -Hours 1)

$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config `
  -Description "Sincroniza o estoque das lojas parceiras a partir desta maquina (cobre Justo Car e Now Car, bloqueadas para servidores)." `
  -Force | Out-Null

Write-Host "Tarefa '$nome' registrada: roda de hora em hora, aos 37 minutos." -ForegroundColor Green
Write-Host "Log em: $(Join-Path $projeto 'logs\sync-local.log')"
