param(
    [string]$PostgresZip = "C:\Sites\DagobertoEasycar\infra\downloads\postgresql-17.10-2-windows-x64-binaries.zip",
    [string]$NssmZip = "C:\Sites\DagobertoEasycar\infra\downloads\nssm-2.24-101-g897c7ad.zip"
)

$ErrorActionPreference = "Stop"
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw "Execute como administrador" }
$currentUserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value

$root = "C:\Sites\DagobertoEasycar"
$postgresRoot = "C:\Program Files\PostgreSQL\17"
$postgresData = Join-Path $root "data\postgres"
$postgresLog = "C:\Logs\DagobertoEasycar\postgres"
$nssmRoot = "C:\Program Files\NSSM\2.24-101"
$serviceName = "postgresql-x64-17"

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { throw "$serviceName já existe; instalação interrompida" }
if ((Test-Path -LiteralPath $postgresRoot) -and -not (Test-Path -LiteralPath (Join-Path $postgresRoot "bin\initdb.exe"))) { throw "$postgresRoot existe, mas não contém uma extração válida" }
if (-not (Test-Path -LiteralPath $PostgresZip)) { throw "Pacote PostgreSQL não encontrado" }
if (-not (Test-Path -LiteralPath $NssmZip)) { throw "Pacote NSSM não encontrado" }

New-Item -ItemType Directory -Path $postgresRoot, $postgresData, $postgresLog, $nssmRoot, (Join-Path $root "secrets") -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $postgresRoot "bin\initdb.exe"))) {
    tar.exe -xf $PostgresZip -C $postgresRoot --strip-components 1
    if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair PostgreSQL" }
}
if (-not (Test-Path -LiteralPath (Join-Path $nssmRoot "win64\nssm.exe"))) {
    tar.exe -xf $NssmZip -C $nssmRoot --strip-components 1
    if ($LASTEXITCODE -ne 0) { throw "Falha ao extrair NSSM" }
}

function New-StrongSecret([int]$bytes = 32) {
    $buffer = New-Object byte[] $bytes
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

$postgresPassword = New-StrongSecret 32
$appPassword = New-StrongSecret 32
$authSecret = New-StrongSecret 48
$cronSecret = New-StrongSecret 48
$adminPassword = New-StrongSecret 24
$secretsRoot = Join-Path $root "secrets"
$postgresPasswordFile = Join-Path $secretsRoot "postgres-superuser.txt"
$adminPasswordFile = Join-Path $secretsRoot "initial-admin.txt"
$initPasswordFile = Join-Path $secretsRoot "initdb-password.tmp"
$postgresPassword | Set-Content -LiteralPath $postgresPasswordFile -Encoding ascii -NoNewline
$postgresPassword | Set-Content -LiteralPath $initPasswordFile -Encoding ascii -NoNewline
@("E-mail: meucomercioonline5@gmail.com", "Senha inicial: $adminPassword", "Troca obrigatória no primeiro acesso.") | Set-Content -LiteralPath $adminPasswordFile -Encoding UTF8

icacls.exe $secretsRoot /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*$($currentUserSid):(OI)(CI)F" | Out-Null
icacls.exe $postgresData /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-20:(OI)(CI)M" "*$($currentUserSid):(OI)(CI)F" | Out-Null
icacls.exe $postgresLog /inheritance:r /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-20:(OI)(CI)M" "*$($currentUserSid):(OI)(CI)F" | Out-Null

$bin = Join-Path $postgresRoot "bin"
& (Join-Path $bin "initdb.exe") --pgdata=$postgresData --username=postgres --pwfile=$initPasswordFile --auth=scram-sha-256 --encoding=UTF8
if ($LASTEXITCODE -ne 0) { throw "initdb falhou" }
Remove-Item -LiteralPath $initPasswordFile -Force

@(
    "listen_addresses = '127.0.0.1'",
    "port = 5432",
    "max_connections = 60",
    "shared_buffers = 256MB",
    "password_encryption = 'scram-sha-256'",
    "logging_collector = on",
    "log_directory = 'C:/Logs/DagobertoEasycar/postgres'",
    "log_filename = 'postgresql-%Y-%m-%d.log'",
    "log_rotation_age = 1d",
    "log_truncate_on_rotation = on"
) | Add-Content -LiteralPath (Join-Path $postgresData "postgresql.conf") -Encoding UTF8

& (Join-Path $bin "pg_ctl.exe") register -N $serviceName -D $postgresData -S auto
if ($LASTEXITCODE -ne 0) { throw "Registro do serviço PostgreSQL falhou" }
sc.exe config $serviceName obj= "NT AUTHORITY\NetworkService" password= "" | Out-Null
Start-Service -Name $serviceName

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & (Join-Path $bin "pg_isready.exe") --host 127.0.0.1 --port 5432 --username postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "PostgreSQL não ficou pronto" }

$env:PGPASSWORD = $postgresPassword
& (Join-Path $bin "psql.exe") --host 127.0.0.1 --username postgres --dbname postgres --set ON_ERROR_STOP=1 --command "CREATE ROLE dagoberto_app LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
if ($LASTEXITCODE -ne 0) { throw "Criação do usuário da aplicação falhou" }
& (Join-Path $bin "createdb.exe") --host 127.0.0.1 --username postgres --owner dagoberto_app --encoding UTF8 dagoberto_easycar
if ($LASTEXITCODE -ne 0) { throw "Criação do banco falhou" }
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

$commit = git.exe -C $root rev-parse --short HEAD
$environmentFile = Join-Path $root ".env.production"
@(
    "NODE_ENV=production",
    "NEXT_PUBLIC_SITE_URL=https://www.dagobertoeasycar.com.br",
    "APP_URL=https://www.dagobertoeasycar.com.br",
    "DATABASE_URL=postgresql://dagoberto_app:$appPassword@127.0.0.1:5432/dagoberto_easycar",
    "AUTH_SECRET=$authSecret",
    "UPLOAD_DIR=C:\Sites\DagobertoEasycar\data\uploads",
    "CRON_SECRET=$cronSecret",
    "APP_VERSION=$commit",
    "ADMIN_EMAIL=meucomercioonline5@gmail.com"
) | Set-Content -LiteralPath $environmentFile -Encoding UTF8
icacls.exe $environmentFile /inheritance:r /grant:r "*S-1-5-32-544:F" "*S-1-5-18:F" "*S-1-5-20:R" "*$($currentUserSid):F" | Out-Null

$env:NODE_ENV = "production"
$env:DATABASE_URL = "postgresql://dagoberto_app:$appPassword@127.0.0.1:5432/dagoberto_easycar"
$env:AUTH_SECRET = $authSecret
$env:ADMIN_EMAIL = "meucomercioonline5@gmail.com"
$env:ADMIN_INITIAL_PASSWORD = $adminPassword
Set-Location -LiteralPath $root
& "C:\Program Files\nodejs\node.exe" "scripts\migrate.mjs"
if ($LASTEXITCODE -ne 0) { throw "Migrations falharam" }
& "C:\Program Files\nodejs\node.exe" "scripts\create-admin.mjs"
if ($LASTEXITCODE -ne 0) { throw "Criação do administrador falhou" }
Remove-Item Env:ADMIN_INITIAL_PASSWORD -ErrorAction SilentlyContinue

Write-Output "PostgreSQL instalado, banco migrado e administrador inicial criado. Credenciais protegidas em C:\Sites\DagobertoEasycar\secrets."
