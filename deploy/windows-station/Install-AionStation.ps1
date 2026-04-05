# ═══════════════════════════════════════════════════════════════
# AION STATION INSTALLER — Windows 10/11 Workstation Setup
# Clave Seguridad CTA — Central de Monitoreo 24/7
# ═══════════════════════════════════════════════════════════════
#
# EJECUTAR COMO ADMINISTRADOR:
# 1. Click derecho en este archivo → "Ejecutar con PowerShell"
# 2. O abrir PowerShell como Admin y pegar:
#    Set-ExecutionPolicy Bypass -Scope Process -Force
#    .\Install-AionStation.ps1
#
# QUE INSTALA:
# - Chrome con perfil dedicado AION (kiosk mode ready)
# - Configuracion de Windows para 24/7 (sin sleep, sin updates auto)
# - Accesos directos en escritorio y barra de tareas
# - Auto-inicio al encender el equipo
# - Monitoreo de conectividad (watchdog local)
# - Audio configurado para alertas
# - Firewall rules para go2rtc WebRTC
# ═══════════════════════════════════════════════════════════════

param(
    [string]$AionUrl = "https://aionseg.co",
    [string]$StationName = "CCTV-CENTRAL-01",
    [string]$OperatorRole = "operator",
    [switch]$KioskMode = $false,
    [switch]$DualMonitor = $false,
    [switch]$SkipRestart = $false
)

$ErrorActionPreference = "Continue"
$AionDir = "$env:ProgramData\AionStation"
$LogFile = "$AionDir\install.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line -ForegroundColor $(switch($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "OK"    { "Green" }
        default { "White" }
    })
    if (Test-Path (Split-Path $LogFile)) {
        Add-Content -Path $LogFile -Value $line
    }
}

function Show-Banner {
    Write-Host ""
    Write-Host "  ====================================================" -ForegroundColor Cyan
    Write-Host "  |                                                  |" -ForegroundColor Cyan
    Write-Host "  |   AION SECURITY PLATFORM                        |" -ForegroundColor Cyan
    Write-Host "  |   STATION INSTALLER v1.0                        |" -ForegroundColor Cyan
    Write-Host "  |   Clave Seguridad CTA                           |" -ForegroundColor Cyan
    Write-Host "  |                                                  |" -ForegroundColor Cyan
    Write-Host "  ====================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
# PASO 0: Verificar privilegios de administrador
# ═══════════════════════════════════════════════════════════════

Show-Banner

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "  ERROR: Ejecutar como Administrador" -ForegroundColor Red
    Write-Host "  Click derecho -> Ejecutar como administrador" -ForegroundColor Yellow
    Read-Host "  Presiona Enter para salir"
    exit 1
}

New-Item -Path $AionDir -ItemType Directory -Force | Out-Null
New-Item -Path "$AionDir\logs" -ItemType Directory -Force | Out-Null
New-Item -Path "$AionDir\config" -ItemType Directory -Force | Out-Null
New-Item -Path "$AionDir\sounds" -ItemType Directory -Force | Out-Null
New-Item -Path "$AionDir\scripts" -ItemType Directory -Force | Out-Null

Write-Log "Instalacion iniciada - Estacion: $StationName"
Write-Log "URL AION: $AionUrl"

# ═══════════════════════════════════════════════════════════════
# PASO 1: Instalar Chrome (si no esta)
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 1: Verificando Google Chrome..."

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $chromePath)) {
    Write-Log "Chrome no encontrado - instalando..." "WARN"
    $chromeInstaller = "$env:TEMP\ChromeSetup.exe"
    try {
        Invoke-WebRequest -Uri "https://dl.google.com/chrome/install/latest/chrome_installer.exe" -OutFile $chromeInstaller -UseBasicParsing
        Start-Process -FilePath $chromeInstaller -Args "/silent /install" -Wait
        Write-Log "Chrome instalado" "OK"
        $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    } catch {
        Write-Log "No se pudo descargar Chrome. Instalar manualmente." "ERROR"
    }
} else {
    Write-Log "Chrome encontrado: $chromePath" "OK"
}

# ═══════════════════════════════════════════════════════════════
# PASO 2: Crear perfil dedicado de Chrome para AION
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 2: Configurando perfil Chrome AION..."

$chromeProfile = "$env:LOCALAPPDATA\Google\Chrome\User Data\AION-Station"
if (-not (Test-Path $chromeProfile)) {
    New-Item -Path $chromeProfile -ItemType Directory -Force | Out-Null
}

$chromePrefs = @{
    profile = @{
        name = "AION Monitor"
        default_content_setting_values = @{
            notifications = 1
            media_stream_mic = 1
            media_stream_camera = 1
        }
    }
    browser = @{
        show_home_button = $false
        check_default_browser = $false
    }
    session = @{
        restore_on_startup = 1
    }
    download = @{
        default_directory = "$AionDir\downloads"
        prompt_for_download = $false
    }
} | ConvertTo-Json -Depth 5

$prefsPath = "$chromeProfile\Preferences"
if (-not (Test-Path $prefsPath)) {
    Set-Content -Path $prefsPath -Value $chromePrefs -Encoding UTF8
    Write-Log "Perfil Chrome AION creado" "OK"
}

# ═══════════════════════════════════════════════════════════════
# PASO 3: Configurar Windows para 24/7 sin interrupciones
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 3: Configurando Windows para operacion 24/7..."

powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /h off
Write-Log "  Sleep/hibernate desactivado" "OK"

$highPerfGuid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
powercfg /setactive $highPerfGuid 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg /duplicatescheme $highPerfGuid 2>$null
    powercfg /setactive $highPerfGuid 2>$null
}
Write-Log "  Plan de energia: Alto rendimiento" "OK"

$wuPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (-not (Test-Path $wuPath)) {
    New-Item -Path $wuPath -Force | Out-Null
}
Set-ItemProperty -Path $wuPath -Name "NoAutoUpdate" -Value 0 -Type DWord
Set-ItemProperty -Path $wuPath -Name "AUOptions" -Value 2 -Type DWord
Set-ItemProperty -Path $wuPath -Name "NoAutoRebootWithLoggedOnUsers" -Value 1 -Type DWord
Write-Log "  Windows Update: notifica pero NO reinicia automaticamente" "OK"

Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0"
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "0"
Write-Log "  Screensaver desactivado" "OK"

Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "InactivityTimeoutSecs" -Value 0 -Type DWord 2>$null
Write-Log "  Lock screen timeout desactivado" "OK"

# ═══════════════════════════════════════════════════════════════
# PASO 4: Crear accesos directos
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 4: Creando accesos directos..."

$chromeExe = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromeExe) {
    $WshShell = New-Object -ComObject WScript.Shell

    $shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\AION Monitor.lnk")
    $shortcut.TargetPath = $chromeExe
    $shortcut.Arguments = "--profile-directory=`"AION-Station`" --start-maximized --autoplay-policy=no-user-gesture-required `"$AionUrl/dashboard`""
    $shortcut.WorkingDirectory = Split-Path $chromeExe
    $shortcut.Description = "AION Security Monitor - Clave Seguridad"
    $shortcut.Save()
    Write-Log "  Acceso directo: AION Monitor (escritorio)" "OK"

    $shortcut2 = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\AION Kiosk.lnk")
    $shortcut2.TargetPath = $chromeExe
    $shortcut2.Arguments = "--profile-directory=`"AION-Station`" --kiosk --autoplay-policy=no-user-gesture-required `"$AionUrl/dashboard`""
    $shortcut2.Description = "AION Kiosk Mode - Pantalla completa"
    $shortcut2.Save()
    Write-Log "  Acceso directo: AION Kiosk (escritorio)" "OK"

    if ($DualMonitor) {
        $shortcut3 = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\AION LiveView.lnk")
        $shortcut3.TargetPath = $chromeExe
        $shortcut3.Arguments = "--profile-directory=`"AION-Station`" --new-window --start-maximized `"$AionUrl/live`""
        $shortcut3.Description = "AION LiveView - Segundo monitor"
        $shortcut3.Save()
        Write-Log "  Acceso directo: AION LiveView (segundo monitor)" "OK"
    }

    $shortcut4 = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\AION Admin (n8n).lnk")
    $shortcut4.TargetPath = $chromeExe
    $shortcut4.Arguments = "--profile-directory=`"AION-Station`" `"$AionUrl/n8n/`""
    $shortcut4.Description = "AION n8n Automations"
    $shortcut4.Save()
    Write-Log "  Acceso directo: AION Admin n8n" "OK"
} else {
    Write-Log "Chrome no encontrado para crear accesos directos" "ERROR"
}

# ═══════════════════════════════════════════════════════════════
# PASO 5: Auto-inicio al encender Windows
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 5: Configurando auto-inicio..."

$startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

$autoStartScript = @"
@echo off
REM AION Station Auto-Start
timeout /t 15 /nobreak > nul

:check_connection
ping -n 1 aionseg.co > nul 2>&1
if errorlevel 1 (
    echo Esperando conexion a AION...
    timeout /t 5 /nobreak > nul
    goto check_connection
)

start "" "$chromeExe" --profile-directory="AION-Station" --start-maximized --autoplay-policy=no-user-gesture-required "$AionUrl/dashboard"
$(if ($DualMonitor) { "timeout /t 5 /nobreak > nul`nstart `"`" `"$chromeExe`" --profile-directory=`"AION-Station`" --new-window --start-maximized `"$AionUrl/live`"" })
start /min "" powershell -ExecutionPolicy Bypass -File "$AionDir\scripts\watchdog.ps1"
"@

Set-Content -Path "$startupDir\AION-AutoStart.bat" -Value $autoStartScript -Encoding ASCII
Write-Log "  Auto-inicio configurado" "OK"

# ═══════════════════════════════════════════════════════════════
# PASO 6: Watchdog de conectividad
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 6: Instalando watchdog..."

$watchdogScript = @'
# AION Watchdog - Monitorea conectividad y reinicia Chrome si es necesario
$AionUrl = "https://aionseg.co"
$CheckInterval = 120
$LogFile = "$env:ProgramData\AionStation\logs\watchdog.log"
$MaxLogSize = 5MB

function Write-WatchdogLog {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt $MaxLogSize)) {
        $backup = $LogFile -replace '\.log$', "-$(Get-Date -Format 'yyyyMMdd').log"
        Move-Item $LogFile $backup -Force
    }
}

Write-WatchdogLog "Watchdog iniciado"

while ($true) {
    Start-Sleep -Seconds $CheckInterval

    # 1. Verificar conectividad
    try {
        $r = Invoke-WebRequest -Uri "$AionUrl/api/health/ready" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -ne 200) { Write-WatchdogLog "WARN: AION responde $($r.StatusCode)" }
    } catch {
        Write-WatchdogLog "ERROR: AION no responde"
        $retries = 0; $ok = $false
        while ($retries -lt 3 -and -not $ok) {
            Start-Sleep -Seconds 30
            try { Invoke-WebRequest -Uri "$AionUrl/api/health/ready" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop | Out-Null; $ok = $true; Write-WatchdogLog "OK: Recuperado" } catch { $retries++ }
        }
        if (-not $ok) {
            Write-WatchdogLog "CRITICAL: AION no responde x3"
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.MessageBox]::Show("AION no responde. Verificar internet.", "AION ALERTA", 0, 48)
        }
    }

    # 2. Chrome abierto?
    $chrome = Get-Process -Name "chrome" -ErrorAction SilentlyContinue
    if (-not $chrome) {
        Write-WatchdogLog "WARN: Chrome cerrado - reabriendo"
        $exe = @("C:\Program Files\Google\Chrome\Application\chrome.exe","C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($exe) { Start-Process $exe -ArgumentList "--profile-directory=`"AION-Station`" --start-maximized `"$AionUrl/dashboard`"" }
    }

    # 3. RAM check (>8GB = restart Chrome)
    $memMB = (Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Measure-Object WorkingSet -Sum).Sum / 1MB
    if ($memMB -gt 8192) {
        Write-WatchdogLog "WARN: Chrome $([int]$memMB)MB - reiniciando"
        Get-Process -Name "chrome" | Stop-Process -Force; Start-Sleep -Seconds 5
        $exe = @("C:\Program Files\Google\Chrome\Application\chrome.exe","C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($exe) { Start-Process $exe -ArgumentList "--profile-directory=`"AION-Station`" --start-maximized `"$AionUrl/dashboard`"" }
    }

    # 4. Status log cada hora
    if ((Get-Date).Minute -eq 0) {
        $up = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
        $ram = [int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
        $cpu = [int](Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
        Write-WatchdogLog "STATUS: Uptime=$($up.Days)d$($up.Hours)h RAM=${ram}MB CPU=${cpu}%"
    }
}
'@

Set-Content -Path "$AionDir\scripts\watchdog.ps1" -Value $watchdogScript -Encoding UTF8
Write-Log "  Watchdog instalado" "OK"

# ═══════════════════════════════════════════════════════════════
# PASO 7: Firewall rules para WebRTC
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 7: Configurando firewall..."

$rules = @(
    @{Name="AION-WebRTC-UDP"; Protocol="UDP"; Port="10000-65535"; Dir="Inbound"},
    @{Name="AION-WebRTC-Out"; Protocol="UDP"; Port="10000-65535"; Dir="Outbound"},
    @{Name="AION-HTTPS"; Protocol="TCP"; Port="443"; Dir="Outbound"}
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if (-not $existing) {
        if ($rule.Dir -eq "Inbound") {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol $rule.Protocol -LocalPort $rule.Port -Action Allow -Profile Any -Enabled True | Out-Null
        } else {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Outbound -Protocol $rule.Protocol -Action Allow -Profile Any -Enabled True | Out-Null
        }
        Write-Log "  Firewall: $($rule.Name)" "OK"
    }
}

# ═══════════════════════════════════════════════════════════════
# PASO 8: Configuracion de audio
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 8: Configurando audio..."

$audioDevices = Get-CimInstance Win32_SoundDevice
if ($audioDevices) {
    Write-Log "  Dispositivos de audio: $($audioDevices.Count)" "OK"
} else {
    Write-Log "  Sin dispositivo de audio - alertas sonoras no funcionaran" "WARN"
}

# ═══════════════════════════════════════════════════════════════
# PASO 9: Guardar configuracion
# ═══════════════════════════════════════════════════════════════

Write-Log "PASO 9: Guardando configuracion..."

$config = @{
    station_name = $StationName
    aion_url = $AionUrl
    operator_role = $OperatorRole
    kiosk_mode = $KioskMode.IsPresent
    dual_monitor = $DualMonitor.IsPresent
    installed_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    installer_version = "1.0.0"
    windows_version = (Get-CimInstance Win32_OperatingSystem).Caption
    chrome_path = $chromeExe
} | ConvertTo-Json -Depth 3

Set-Content -Path "$AionDir\config\station.json" -Value $config -Encoding UTF8
Write-Log "  Configuracion guardada" "OK"

# ═══════════════════════════════════════════════════════════════
# PASO 10: Script de desinstalacion
# ═══════════════════════════════════════════════════════════════

$uninstall = @"
Write-Host "Desinstalando AION Station..." -ForegroundColor Yellow
powercfg /change monitor-timeout-ac 15
powercfg /change standby-timeout-ac 30
Remove-Item "`$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AION-AutoStart.bat" -Force -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName "AION-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Remove-Item "`$env:USERPROFILE\Desktop\AION*.lnk" -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "1"
Write-Host "AION Station desinstalado. Reiniciar para aplicar." -ForegroundColor Green
"@

Set-Content -Path "$AionDir\Uninstall-AionStation.ps1" -Value $uninstall -Encoding UTF8

# ═══════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "  ====================================================" -ForegroundColor Green
Write-Host "  |  INSTALACION COMPLETA                             |" -ForegroundColor Green
Write-Host "  |                                                   |" -ForegroundColor Green
Write-Host "  |  Estacion: $StationName" -ForegroundColor Green
Write-Host "  |  URL: $AionUrl" -ForegroundColor Green
Write-Host "  |                                                   |" -ForegroundColor Green
Write-Host "  |  Instalado:                                       |" -ForegroundColor Green
Write-Host "  |  [OK] Chrome con perfil dedicado AION             |" -ForegroundColor Green
Write-Host "  |  [OK] Windows 24/7 (sin sleep/screensaver)        |" -ForegroundColor Green
Write-Host "  |  [OK] Auto-inicio al encender                     |" -ForegroundColor Green
Write-Host "  |  [OK] Watchdog de conectividad                    |" -ForegroundColor Green
Write-Host "  |  [OK] Firewall rules para WebRTC                  |" -ForegroundColor Green
Write-Host "  |  [OK] Accesos directos en escritorio              |" -ForegroundColor Green
Write-Host "  |                                                   |" -ForegroundColor Green
Write-Host "  |  Desinstalar: $AionDir\Uninstall-AionStation.ps1" -ForegroundColor Gray
Write-Host "  |                                                   |" -ForegroundColor Green
Write-Host "  ====================================================" -ForegroundColor Green
Write-Host ""

if (-not $SkipRestart) {
    Write-Host "  Se recomienda reiniciar Windows." -ForegroundColor Yellow
    $restart = Read-Host "  Reiniciar ahora? (S/N)"
    if ($restart -eq "S" -or $restart -eq "s") {
        Write-Log "Reiniciando Windows..."
        Restart-Computer -Force
    }
}

Write-Log "Instalacion completada exitosamente" "OK"
