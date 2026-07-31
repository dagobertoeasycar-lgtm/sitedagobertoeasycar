param([string]$Branch = "main")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logFile = "C:\Logs\DagobertoEasycar\deploy.log"
$environmentFile = Join-Path $root ".env.production"
$releaseRoot = [IO.Path]::GetFullPath("C:\Backups\DagobertoEasycar\releases").TrimEnd("\")
$nextPath = [IO.Path]::GetFullPath((Join-Path $root ".next"))
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$serviceStopped = $false
$buildBackup = $null
$environmentOriginal = $null

function Invoke-Native([scriptblock]$Command, [string]$Description) {
    $output = & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Description falhou com código $LASTEXITCODE" }
    return $output
}

function Set-ProcessEnvironment([string[]]$Lines) {
    foreach ($line in $Lines) {
        if ($line -match "^([^#=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$previous = (Invoke-Native { git -C $root rev-parse HEAD } "Leitura do commit atual").Trim()
"$(Get-Date -Format o) início commit=$previous" | Add-Content -LiteralPath $logFile -Encoding UTF8

try {
    & (Join-Path $PSScriptRoot "backup.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Backup pré-deploy falhou com código $LASTEXITCODE" }

    Invoke-Native { git -C $root fetch origin $Branch } "Git fetch" | Out-Null
    Invoke-Native { git -C $root checkout $Branch } "Git checkout" | Out-Null
    Invoke-Native { git -C $root pull --ff-only origin $Branch } "Git pull" | Out-Null
    Invoke-Native { corepack pnpm --dir $root install --frozen-lockfile } "Instalação de dependências" | Out-Null

    $environmentOriginal = [IO.File]::ReadAllLines($environmentFile)
    $current = (Invoke-Native { git -C $root rev-parse HEAD } "Leitura do novo commit").Trim()
    $updated = @($environmentOriginal | ForEach-Object { if ($_ -match "^APP_VERSION=") { "APP_VERSION=$($current.Substring(0, 7))" } else { $_ } })
    [IO.File]::WriteAllLines($environmentFile, $updated, (New-Object Text.UTF8Encoding($false)))
    Set-ProcessEnvironment $updated
    Invoke-Native { corepack pnpm --dir $root db:migrate } "Migrations" | Out-Null

    Stop-Service DagobertoEasycarApp -Force
    $serviceStopped = $true
    if (Test-Path -LiteralPath $nextPath) {
        New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
        $buildBackup = [IO.Path]::GetFullPath((Join-Path $releaseRoot "build-$stamp-$($previous.Substring(0, 7))"))
        if (-not $buildBackup.StartsWith($releaseRoot + "\", [StringComparison]::OrdinalIgnoreCase)) { throw "Destino de backup de build inválido" }
        if (Test-Path -LiteralPath $buildBackup) { throw "Backup de build já existe: $buildBackup" }
        Move-Item -LiteralPath $nextPath -Destination $buildBackup
    }

    Invoke-Native { corepack pnpm --dir $root build } "Build" | Out-Null
    $standaloneRoot = Join-Path $root ".next\standalone"
    $standaloneStatic = Join-Path $standaloneRoot ".next\static"
    $standalonePublic = Join-Path $standaloneRoot "public"
    New-Item -ItemType Directory -Path $standaloneStatic, $standalonePublic -Force | Out-Null
    Copy-Item -Path (Join-Path $root ".next\static\*") -Destination $standaloneStatic -Recurse -Force
    Copy-Item -Path (Join-Path $root "public\*") -Destination $standalonePublic -Recurse -Force

    Start-Service DagobertoEasycarApp
    $serviceStopped = $false
    $healthy = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Seconds 3
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/health" -TimeoutSec 5
            if ($health.status -eq "ok" -and $health.database -eq "ok" -and $health.version -eq $current.Substring(0, 7)) { $healthy = $true; break }
        } catch {}
    }
    if (-not $healthy) { throw "Aplicação não ficou saudável na versão esperada em 180 segundos" }
    "$(Get-Date -Format o) sucesso commit=$current backup_build=$buildBackup" | Add-Content -LiteralPath $logFile -Encoding UTF8
} catch {
    if ($serviceStopped -or (Get-Service DagobertoEasycarApp).Status -eq "Running") {
        Stop-Service DagobertoEasycarApp -Force -ErrorAction SilentlyContinue
    }
    if ($buildBackup -and (Test-Path -LiteralPath $buildBackup)) {
        if (Test-Path -LiteralPath $nextPath) { Remove-Item -LiteralPath $nextPath -Recurse -Force }
        Move-Item -LiteralPath $buildBackup -Destination $nextPath
    }
    if ($environmentOriginal) { [IO.File]::WriteAllLines($environmentFile, $environmentOriginal, (New-Object Text.UTF8Encoding($false))) }
    Start-Service DagobertoEasycarApp -ErrorAction SilentlyContinue
    "$(Get-Date -Format o) falha commit=$previous erro=$($_.Exception.Message)" | Add-Content -LiteralPath $logFile -Encoding UTF8
    throw
}
