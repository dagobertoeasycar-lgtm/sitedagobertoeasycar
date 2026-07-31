$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $root ".env.production"
if (-not (Test-Path -LiteralPath $environmentFile)) { throw ".env.production não encontrado" }

function Read-Default([string]$label, [string]$default) {
    $value = Read-Host "$label [$default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    return $value.Trim()
}

$original = [IO.File]::ReadAllLines($environmentFile)
$settings = @{}
foreach ($line in $original) {
    if ($line -match "^([^#=]+)=(.*)$") { $settings[$matches[1].Trim()] = $matches[2].Trim() }
}

$hostName = Read-Default "Servidor SMTP" $(if ($settings["SMTP_HOST"]) { $settings["SMTP_HOST"] } else { "smtp.gmail.com" })
$portText = Read-Default "Porta SMTP" $(if ($settings["SMTP_PORT"]) { $settings["SMTP_PORT"] } else { "587" })
$smtpUser = Read-Default "Usuário SMTP" $(if ($settings["SMTP_USER"]) { $settings["SMTP_USER"] } else { "meucomercioonline5@gmail.com" })
$smtpFrom = Read-Default "Remetente" $(if ($settings["SMTP_FROM"]) { $settings["SMTP_FROM"] } else { "Dagoberto Easycar <meucomercioonline5@gmail.com>" })
$adminEmail = Read-Default "Destinatário dos leads" $(if ($settings["ADMIN_EMAIL"]) { $settings["ADMIN_EMAIL"] } else { "meucomercioonline5@gmail.com" })
$port = 0
if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) { throw "Porta SMTP inválida" }
$securePassword = Read-Host "Senha de app SMTP (entrada oculta)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($hostName -eq "smtp.gmail.com") { $password = $password.Replace(" ", "") }
    if ([string]::IsNullOrWhiteSpace($password)) { throw "Senha de app vazia" }

    $updates = [ordered]@{
        SMTP_HOST = $hostName
        SMTP_PORT = $port.ToString()
        SMTP_USER = $smtpUser
        SMTP_PASSWORD = $password
        SMTP_FROM = $smtpFrom
        ADMIN_EMAIL = $adminEmail
    }
    $output = [Collections.Generic.List[string]]::new()
    $seen = @{}
    foreach ($line in $original) {
        if ($line -match "^([^#=]+)=") {
            $key = $matches[1].Trim()
            if ($updates.Contains($key)) { $output.Add("$key=$($updates[$key])"); $seen[$key] = $true; continue }
        }
        $output.Add($line)
    }
    foreach ($key in $updates.Keys) { if (-not $seen[$key]) { $output.Add("$key=$($updates[$key])") } }
    [IO.File]::WriteAllLines($environmentFile, $output, (New-Object Text.UTF8Encoding($false)))

    & (Get-Command node.exe).Source (Join-Path $PSScriptRoot "test-smtp.mjs") --send
    if ($LASTEXITCODE -ne 0) { throw "Teste SMTP falhou" }
    Restart-Service -Name "DagobertoEasycarApp" -Force
    Write-Host "SMTP configurado, mensagem de teste aceita e serviço reiniciado." -ForegroundColor Green
} catch {
    [IO.File]::WriteAllLines($environmentFile, $original, (New-Object Text.UTF8Encoding($false)))
    throw
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $password = $null
}
