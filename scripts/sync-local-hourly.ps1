# =============================================================================
# sync-local-hourly.ps1
#
# Sincroniza o estoque dos parceiros a partir DESTA maquina, de hora em hora.
#
# POR QUE EXISTE: Justo Car e Now Car ficam atras da Cloudflare, que bloqueia
# IP de datacenter (GitHub Actions, nuvem) com HTTP 403. De uma conexao comum,
# como esta, as mesmas URLs respondem 200. As outras lojas (EasyCar, Tchesco,
# Guiotti) ja atualizam pela nuvem, pelo workflow sync-estoque.yml; esta tarefa
# e complemento, nao substituto, e as duas podem rodar juntas sem conflito
# porque o sync usa trava com prazo no banco.
#
# Registrar a tarefa:  .\scripts\setup-sync-local.ps1
# Rodar na mao:        .\scripts\sync-local-hourly.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$projeto = $null
foreach ($c in @((Split-Path -Parent $base), $base, (Get-Location).Path) | Where-Object { $_ }) {
  if (Test-Path (Join-Path $c "scripts\sync-partners.mjs")) { $projeto = $c; break }
}
if (-not $projeto) {
  Write-Host "Nao encontrei a raiz do projeto." -ForegroundColor Red
  exit 1
}

Set-Location $projeto

$envFile = Join-Path $projeto ".env.local"
if (-not (Test-Path $envFile)) {
  Write-Host "Falta o arquivo .env.local com a DATABASE_URL." -ForegroundColor Red
  exit 1
}

$logDir = Join-Path $projeto "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir "sync-local.log"

$inicio = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
Add-Content -Path $log -Value "===== $inicio ====="

# --env-file mantem a DATABASE_URL fora da linha de comando e do historico.
& node --no-warnings --env-file=.env.local scripts/sync-partners.mjs 2>&1 |
  Tee-Object -FilePath $log -Append

# Mantem o log em tamanho razoavel (ultimas 2000 linhas).
if ((Get-Content $log).Count -gt 2000) {
  Get-Content $log -Tail 2000 | Set-Content "$log.tmp"
  Move-Item "$log.tmp" $log -Force
}
