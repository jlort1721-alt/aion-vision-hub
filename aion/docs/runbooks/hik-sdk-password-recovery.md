# Runbook — Hikvision HCNetSDK password recovery

## Contexto

El worker `aion-hik-sdk.service` valida login SDK de los 28 devices Hikvision
usando `NET_DVR_Login_V40`. Cada device puede tener distinto password admin.

## Passwords conocidos (2026-04-17)

Ordenados por frecuencia:

| Password | Devices (confirmados via SDK) | Count |
|---|---|---|
| `Clave.seg2023` | 15 devices (mayoría DVR/NVR) | 15 |
| `Seg12345` (S mayúscula) | AC Altagracia, AC Pisquines, AC Portalegre | 3 |
| `seg12345` (s minúscula) | AC Brescia, AC San Nicolas, DVR Torre Lucia | 3 |

**Total 21/28 devices con login SDK confirmado (75%)**.

## Devices con password aún desconocido (7)

Requieren credencial manual del operador:

| Device | IP:Port | Último error |
|---|---|---|
| AC San Sebastian | 186.97.106.252:8081 | PW_ERROR con las 3 passwords conocidas |
| AC GYM Torre Lucia | 181.205.215.210:8040 | NET_TIMEOUT (firewall NAT cliente) |
| AC NORTE Torre Lucia | 181.205.215.210:8081 | NET_TIMEOUT |
| AC SUR Torre Lucia | 181.205.215.210:8060 | NET_TIMEOUT |
| AC TER Torre Lucia | 181.205.215.210:8070 | NET_TIMEOUT |
| LPR Altagracia | 181.205.175.18:8010 | NET_FAIL_CONNECT (puerto mal o bloqueado) |
| AC San Sebastian 8080 | 186.97.106.252:8080 | NET_FAIL (puerto real es 8081, ya actualizado en DB) |

## Cómo agregar un password nuevo

```bash
ssh aion-vps
# 1. Agregar a env file
sudo sed -i "/HIK_PASS_ALT2=/a HIK_PASS_ALT3=NUEVO_PASSWORD" /etc/aion/secrets/sdk-workers.env

# 2. Actualizar worker Config.load() para leer HIK_PASS_ALT3
sudo nano /opt/aion/sdk-workers/hik_sdk_worker.py
# En Config.load(), añadir al list pws:
#   os.environ.get("HIK_PASS_ALT3", ""),
# En la comprensión que dedupa sirve igual.

# 3. Reload systemd + restart
sudo systemctl daemon-reload
sudo systemctl restart aion-hik-sdk aion-hik-alarms

# 4. Verificar
sudo tail -f /var/log/aion/hik-sdk-worker.log
```

## Auditoría manual (cuando sospechas cambios de password)

```bash
# Script que prueba 3 passwords en todos los Hikvision y reporta cuál ganó:
sudo -u postgres /opt/aion/sdk-workers/venv/bin/python /tmp/hik-audit-v2.py
```

Produce tabla `✓/✗ Device IP:Port pw=XXX` con cuál password autenticó cada
device y un summary final.

## Para los 4 Torre Lucia (NET_TIMEOUT)

El DVR/controlador físico responde a la IP pública `181.205.215.210` pero
los puertos 8040/8060/8070/8081 no llegan al VPS via TCP. Causa probable:

1. **NAT del router del cliente** no forwarding esos puertos
2. **Firewall ISP** bloqueando conexiones a esos puertos
3. **Device offline** en ese momento

**Resolución:** operador del sitio debe verificar port forwarding en el
router del cliente. Confirmar que desde internet externo responden TCP.

## Para los 2 NET_FAIL (LPR Altagracia, AC San Sebastian 8080)

- **LPR Altagracia 181.205.175.18:8010** → el puerto 8010 probablemente
  mapea a otro device (la IP tiene también DVR Altagracia en 8030). Pedir
  al operador confirmar puerto real del LPR.
- **AC San Sebastian 8080** → corregido: el puerto real es 8081. Actualizado
  en DB: `UPDATE devices SET port = 8081 WHERE name = 'AC San Sebastian'`.
