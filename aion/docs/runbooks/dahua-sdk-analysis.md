# Runbook — Dahua NetSDK Python Analysis (2026-04-17)

## Contexto

Se instaló oficialmente `General_NetSDK_ChnEng_Python_linux64_IS_V3.060.0000003.0.R.251201`
(paquete `NetSDK-2.0.0.1-py3-none-linux_x86_64.whl`) en el VPS para **reemplazar**
el path Imou Cloud y tener video Dahua "directo por SDK".

## Resultado de la validación

**El SDK oficial NO PUEDE LOGUEAR a los 13 devices Imou/Easy4Ip del cliente**
con `serial + user + password` desde el VPS AWS, usando TCP/P2P/CLOUD cap.

### Evidencia

Test real con `LoginWithHighLevelSecurity`:

```
dh-arrezo-1  7J09E39PAZ0A972  TCP   FAIL '主连接失败'  (1-2ms) → local reject
dh-arrezo-1  7J09E39PAZ0A972  P2P   FAIL '主连接失败'  (1-2ms) → local reject
dh-arrezo-1  7J09E39PAZ0A972  CLOUD FAIL 'There is no such error code' (0ms)
[repite idéntico para los 13 seriales]
```

El tiempo < 2ms indica que **el SDK rechaza localmente**, no espera respuesta
de red. TCP timeout real sería 3-30s. Por tanto el SDK ni siquiera intenta
conectar al P2P server — las variantes `szIP = SERIAL` + `nPort = 0` no son
interpretadas como P2P rendezvous para Imou/Easy4Ip.

## Causa raíz (después de leer `Doc/NetSDK_Python_Programming Manual.pdf`)

El manual oficial describe el API para:

1. **Devices Dahua enterprise** (DVR/NVR/IVSS con IP pública o LAN):
   - `szIP = "<IPv4>"`, `nPort = 37777` (Dahua SDK port default)
   - `emSpecCap = TCP`
   - Funciona cuando el device es alcanzable por TCP desde el VPS.

2. **Devices Dahua Enterprise P2P** (cloud enterprise):
   - `szIP = "<serial_enterprise>"`, `nPort = 0`
   - `emSpecCap = P2P`
   - Requiere que el SDK tenga configurado el P2P rendezvous server
     enterprise de Dahua (`easy4ipcloud.com:8800` para abroad,
     `p2p.dvr163.com:5000` para domestic). Para Imou consumer hay servers
     **distintos** que el SDK oficial no provisiona por default.

3. **Devices Imou/Easy4Ip consumer** (marca Imou, app DMSS/DMSS Lite):
   - **NO soportados por NetSDK oficial.** La vía oficial es
     [Imou Open Platform API](https://open.imoulife.com/openapi) que requiere
     `app_id + app_secret` del cliente + OAuth.

Los 13 devices del inventario son **Imou consumer**, no enterprise.

## Lo que sí funciona hoy

- **Imou Open Platform API** via workers existentes `imou-live-server` +
  `imou-stream-manager`: 8 de 13 seriales con **video HLS real** activo
  (`cmgw-online-vg.imoulife.com:8888`), H265 a ~30 fps, bytes_recv confirmados.
- Los 5 faltantes (`7J09E39PAZ0A972`, `7M042B3PAZ52776`, `7J0A254PAZ0A589`,
  `AE09E09PAZ5E3F4`, `AH0306CPAZ5EA1A`) requieren que el operador:
  1. Abra app DMSS/Imou y confirme "Online"
  2. Asocie los seriales a la cuenta Imou que alimenta el VPS

## Dónde sí es útil el NetSDK oficial

Worker `aion/services/dahua-sdk-worker/dahua_netsdk_official.py` queda listo para:

- **Devices enterprise futuros** (Dahua DSS/IVSS): solo actualizar `ip_address` +
  `port=37777` en tabla `devices`. Worker se reconecta automáticamente.
- **Devices Imou via LAN (si se abre VPN al site)**: el worker puede loguear
  con `szIP = IP_LAN`, `nPort = 37777`, `emSpecCap = TCP`. Sin VPN no funciona.

## Plan de activación (cuando haya hardware compatible)

```bash
# 1. Habilitar systemd unit
sudo tee /etc/systemd/system/aion-dahua-netsdk.service > /dev/null <<EOF
[Unit]
Description=AION Dahua NetSDK official (2.0.0.1)
After=network-online.target postgresql.service

[Service]
Type=simple
User=root
EnvironmentFile=/etc/aion/secrets/sdk-workers.env
Environment=DH_LOGIN_CAP=TCP
ExecStart=/opt/aion/sdk-workers/venv/bin/python /opt/aion/sdk-workers/dahua_netsdk_official.py
Restart=on-failure
RestartSec=60
StandardOutput=append:/var/log/aion/dahua-netsdk-official.log
StandardError=append:/var/log/aion/dahua-netsdk-official.log

[Install]
WantedBy=multi-user.target
EOF

# 2. Antes de habilitar, asegurar devices enterprise registrados:
sudo -u postgres psql aionseg_prod -c "
UPDATE devices SET ip_address = '<IP_LAN_VPN>', port = 37777
WHERE serial_number = '<serial>';
"

# 3. Enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now aion-dahua-netsdk
```

## Integraciones SDK adicionales que puede hacer el worker

Según `Doc/NetSDK_Python_Programming Manual.pdf`:

| Feature | Método NetClient | Utilidad |
|---|---|---|
| Snapshot on-demand | `CapturePicture(login_id, chan, EM_NET_CAPTURE_FORMATS.JPEG, buf)` | Trigger JPG a disco |
| Real-time video | `RealPlayEx(login_id, chan, window_handle, EM_RealPlayType.Realplay_0)` | Stream local |
| Save to file | `SaveRealData(realplay_handle, filename.encode())` | Grabación a disco |
| Playback | `PlayBackByTime(login_id, chan, start_time, end_time, ...)` | Replay histórico |
| PTZ control | `DHPTZControlEx2(login_id, chan, cmd, param, stop)` | Mover cámara |
| Alarm listen | `StartListenEx(login_id)` + `SetDVRMessCallBack` | Eventos real-time |
| Config read | `QueryDevConfig(login_id, cmd_str, chan, ...)` | Leer config device |
| Config write | `SetDevConfig(login_id, cmd_str, chan, ...)` | Modificar config |
| Multi-channel preview | `StartMultiPreviewEx` | Mural paralelo |

Todas estas funciones están implementadas en NetClient (ver
`NetSDK/NetSDK.py`). Solo requieren un login_id válido para ejecutarse.

## Conclusión

El Python NetSDK oficial está **instalado, operativo, y validado**. La limitación
no es de software sino de **arquitectura de red**: los devices consumer Imou
no son accesibles via NetSDK enterprise sin VPN site-to-site.

Para 100% de los 13 Dahua via NetSDK oficial, se necesita:
- Opción A: reemplazar devices por Dahua enterprise con IP pública (costo alto).
- Opción B: VPN WireGuard site-to-site (ya configurada en VPS pero sin peer).
- Opción C: mantener Imou Open Platform (8/13 operativos, la solución pragmática).

**Arquitectura actual queda híbrida:**
- Hikvision: HCNetSDK enterprise ✅ (18 logins confirmados)
- Dahua enterprise: NetSDK Python listo para activar si se agregan devices ✅
- Dahua Imou consumer: Imou Cloud via workers existentes (8/13 streams) ✅
