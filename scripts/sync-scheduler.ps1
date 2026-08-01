# Cria tarefa agendada para sync do estoque a cada 10 minutos
$taskName = "DagobertoEasycar-SyncEstoque"
$projectDir = "C:\Sites\DagobertoEasycar"

# Script inline que carrega .env.production e roda o sync
$scriptBlock = @"
Set-Location '$projectDir'
Get-Content '.env.production' | ForEach-Object {
    if (`$_ -match '^([^#=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable(`$Matches[1].Trim(), `$Matches[2].Trim(), 'Process')
    }
}
node scripts/sync-easycar.mjs >> logs/sync.log 2>&1
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
    -ExecutionTimeLimit (New-TimeSpan -Minutes 8) `
    -MultipleInstances IgnoreNew

# Remove existing task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Description "Sync estoque EasyCar a cada 10 minutos"

# Create logs folder
New-Item -ItemType Directory -Force -Path "$projectDir\logs" | Out-Null

Write-Host "Tarefa '$taskName' criada com sucesso! Sync a cada 10 minutos." -ForegroundColor Green
