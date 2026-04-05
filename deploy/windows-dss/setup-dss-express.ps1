# ═══════════════════════════════════════════════════════════
# AION — DSS Express Auto-Setup Script
# Ejecutar como Administrator en el Windows EC2
# ═══════════════════════════════════════════════════════════

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AION DSS Express Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Open firewall ports
Write-Host "`n=== Step 1: Firewall Rules ===" -ForegroundColor Yellow
$ports = @(9100, 9101, 7080, 7081, 5985, 554, 37777)
foreach ($port in $ports) {
    netsh advfirewall firewall add rule name="AION-DSS-$port" dir=in action=allow protocol=TCP localport=$port | Out-Null
    Write-Host "  Opened port $port" -ForegroundColor Green
}

# Enable WinRM for remote management
Write-Host "`n=== Step 2: Enable WinRM ===" -ForegroundColor Yellow
winrm quickconfig -force 2>$null
winrm set winrm/config/service '@{AllowUnencrypted="true"}' 2>$null
winrm set winrm/config/service/auth '@{Basic="true"}' 2>$null
Write-Host "  WinRM enabled" -ForegroundColor Green

# Step 3: Download DSS Express
Write-Host "`n=== Step 3: Download DSS Express ===" -ForegroundColor Yellow
$dssUrl = "https://daabordevolution.s3.us-east-2.amazonaws.com/DSS_Express_V8.2.1.3.exe"
$dssPath = "C:\Temp\DSS_Express_Setup.exe"
New-Item -ItemType Directory -Force -Path "C:\Temp" | Out-Null

if (-not (Test-Path $dssPath)) {
    Write-Host "  Downloading DSS Express (this may take a few minutes)..." -ForegroundColor Yellow
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        # Try direct download
        Invoke-WebRequest -Uri $dssUrl -OutFile $dssPath -UseBasicParsing -ErrorAction Stop
        Write-Host "  Downloaded: $dssPath" -ForegroundColor Green
    } catch {
        Write-Host "  Auto-download failed. Please download DSS Express manually from:" -ForegroundColor Red
        Write-Host "  https://dahuawiki.com/DSS_Express" -ForegroundColor Cyan
        Write-Host "  Save it to: C:\Temp\DSS_Express_Setup.exe" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Or download from Dahua partner portal:" -ForegroundColor Cyan
        Write-Host "  https://partner.dahuatech.com" -ForegroundColor Cyan
    }
} else {
    Write-Host "  DSS Express already downloaded" -ForegroundColor Green
}

# Step 4: Create device configuration files
Write-Host "`n=== Step 4: Create Device Configuration ===" -ForegroundColor Yellow

# DSS Express 1 — 8 XVR (64 channels)
$dss1Devices = @"
# DSS Express Instance 1 — Devices to add via P2P
# After installing DSS Express, add these devices in Device Manager > Add > P2P

Serial Number        | Name               | User  | Password
---------------------|--------------------| ------|-------------
AL02505PAJD40E7     | Alborada           | admin | Clave.seg2023
AK01E46PAZ0BA9C     | Brescia            | admin | Clave.seg2023
AL02505PAJDC6A4     | Patio Bonito       | admin | Clave.seg2023
BB01B89PAJ5DDCD     | Terrabamba         | admin | Clave.seg2023
AJ00421PAZF2E60     | Danubios Clave     | admin | Clave.seg2023
AH0306CPAZ5EA1A     | Danubios Puesto    | CLAVE | Clave.seg2023
AL02505PAJ638AA     | Terrazzino         | admin | Clave.seg2023
AH1020EPAZ39E67     | Quintas SM         | admin | Clave.seg2023
"@
$dss1Devices | Out-File -FilePath "C:\Temp\DSS1_Devices.txt" -Encoding UTF8

# DSS Express 2 — 3 XVR (24 channels)
$dss2Devices = @"
# DSS Express Instance 2 — Devices to add via P2P

Serial Number        | Name               | User  | Password
---------------------|--------------------| ------|-------------
AB081E4PAZD6D5B     | Santana Cabanas    | admin | Clave.seg2023
AE01C60PAZA4D94     | Hospital SJ        | admin | Clave.seg2023
9B02D09PAZ4C0D2     | Factory            | admin | Clave.seg2023
"@
$dss2Devices | Out-File -FilePath "C:\Temp\DSS2_Devices.txt" -Encoding UTF8

Write-Host "  Device lists saved to C:\Temp\" -ForegroundColor Green

# Step 5: Create go2rtc config for VPS
Write-Host "`n=== Step 5: Generate go2rtc Configuration ===" -ForegroundColor Yellow

$privateIP = (Get-NetIPAddress -InterfaceAlias "Ethernet*" -AddressFamily IPv4).IPAddress
Write-Host "  Windows Private IP: $privateIP" -ForegroundColor Cyan

$go2rtcConfig = @"
# ═══ DAHUA streams via DSS Express on $privateIP ═══
# Add these to /etc/go2rtc/go2rtc.yaml on the VPS (18.230.40.6)
# After DSS Express is installed and devices are added

# DSS Express 1 — Port 9100
# Alborada (8 channels)
"@

$sedes1 = @(
    @{prefix="da-alborada"; serial="AL02505PAJD40E7"; channels=8; user="admin"},
    @{prefix="da-brescia"; serial="AK01E46PAZ0BA9C"; channels=8; user="admin"},
    @{prefix="da-pbonito"; serial="AL02505PAJDC6A4"; channels=8; user="admin"},
    @{prefix="da-terrabamba"; serial="BB01B89PAJ5DDCD"; channels=8; user="admin"},
    @{prefix="da-danubios"; serial="AJ00421PAZF2E60"; channels=8; user="admin"},
    @{prefix="da-danubios2"; serial="AH0306CPAZ5EA1A"; channels=8; user="CLAVE"},
    @{prefix="da-terrazzino"; serial="AL02505PAJ638AA"; channels=8; user="admin"},
    @{prefix="da-quintas"; serial="AH1020EPAZ39E67"; channels=8; user="admin"}
)

foreach ($sede in $sedes1) {
    $go2rtcConfig += "`n  # $($sede.prefix)"
    for ($ch = 1; $ch -le $sede.channels; $ch++) {
        $chStr = $ch.ToString("D2")
        $go2rtcConfig += "`n  $($sede.prefix)-ch$($chStr): `"rtsp://$($sede.user):Clave.seg2023@$($privateIP):9100/cam/realmonitor?channel=$ch&subtype=1`""
    }
    $go2rtcConfig += "`n"
}

$go2rtcConfig += @"

# DSS Express 2 — Port 9101
"@

$sedes2 = @(
    @{prefix="da-santana"; serial="AB081E4PAZD6D5B"; channels=8; user="admin"},
    @{prefix="da-hospital"; serial="AE01C60PAZA4D94"; channels=8; user="admin"},
    @{prefix="da-factory"; serial="9B02D09PAZ4C0D2"; channels=4; user="admin"}
)

foreach ($sede in $sedes2) {
    $go2rtcConfig += "`n  # $($sede.prefix)"
    for ($ch = 1; $ch -le $sede.channels; $ch++) {
        $chStr = $ch.ToString("D2")
        $go2rtcConfig += "`n  $($sede.prefix)-ch$($chStr): `"rtsp://$($sede.user):Clave.seg2023@$($privateIP):9101/cam/realmonitor?channel=$ch&subtype=1`""
    }
    $go2rtcConfig += "`n"
}

$go2rtcConfig | Out-File -FilePath "C:\Temp\go2rtc-dahua-streams.yaml" -Encoding UTF8
Write-Host "  go2rtc config saved to C:\Temp\go2rtc-dahua-streams.yaml" -ForegroundColor Green

Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Install DSS Express from C:\Temp\ (or download manually)" -ForegroundColor White
Write-Host "  2. During install, set HTTP port to 7080, RTSP to 9100" -ForegroundColor White
Write-Host "  3. Open DSS Express, go to Device Manager" -ForegroundColor White
Write-Host "  4. Add devices from C:\Temp\DSS1_Devices.txt via P2P" -ForegroundColor White
Write-Host "  5. Install second DSS Express with ports 7081/9101" -ForegroundColor White
Write-Host "  6. Add devices from C:\Temp\DSS2_Devices.txt" -ForegroundColor White
Write-Host "  7. Copy C:\Temp\go2rtc-dahua-streams.yaml to VPS" -ForegroundColor White
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nPrivate IP for VPS config: $privateIP" -ForegroundColor Green
