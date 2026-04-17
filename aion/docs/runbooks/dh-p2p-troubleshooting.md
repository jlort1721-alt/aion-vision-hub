# Runbook — dh-p2p Dahua bridge

## Arquitectura

```
Dahua XVR (P2P online, serial+user+pass)
  ↕ udp/tcp
easy4ipcloud.com:8800 (P2P rendezvous)
  ↕ udp/tcp tunnel
dh-p2p (Python/Rust) en VPS
  ↓ rtsp://127.0.0.1:<puerto>/cam/realmonitor?channel=1
go2rtc (relay + transcode)
  ↓ HLS público
Frontend HLS.js
```

## Estado actual (2026-04-17)

- Código en `/opt/dh-p2p/` (clone 2026-04-02)
- systemd template: `/etc/systemd/system/dh-p2p@.service` para 13 seriales
- Puertos locales: 11554-11566
- **AUTH WIP** — `DevPwd_InvalidSalt` con `--type 0`. Con `--type 1` avanza hasta NAT info pero no completa.
- **No hay servicios habilitados**. Requiere validación manual por serial.

## Habilitar bridge para un serial

```bash
ssh aion-vps

# Ver env configurado
sudo cat /etc/aion/dh-p2p/dh-brescia.env

# Test manual
cd /opt/dh-p2p
sudo timeout 30 ./venv/bin/python main.py $(grep SERIAL /etc/aion/dh-p2p/dh-brescia.env | cut -d= -f2) \
  --type 1 -u admin -p "$(grep PASSWORD /etc/aion/dh-p2p/dh-brescia.env | cut -d= -f2)"

# Si funciona (ve puerto 10554 listening + RTSP responde):
sudo systemctl enable --now dh-p2p@dh-brescia
sudo journalctl -u dh-p2p@dh-brescia -f
```

## Verificar tunnel activo

```bash
# Ver listener
sudo ss -tlnp | grep 115

# Probar RTSP via tunnel
ffprobe -rtsp_transport tcp \
  "rtsp://admin:Clave.seg2023@127.0.0.1:11565/cam/realmonitor?channel=1&subtype=0"
```

## Si falla auth (DevPwd_InvalidSalt)

Problema conocido — el repo tiene un commit `:construction: wip: Implement get randsalt from device info`.

Opciones:

### Opción 1 — Arreglar helpers.py
- Revisar función `get_auth()` en `/opt/dh-p2p/helpers.py`.
- El RANDSALT se obtiene del response `/info/device/{serial}` campo `Info` (encriptado).
- Completar `decrypt_info()` para extraer RANDSALT y pasarlo a `get_auth()`.

### Opción 2 — Compilar versión Rust
```bash
ssh aion-vps
sudo apt install -y cargo
cd /opt/dh-p2p
sudo cargo build --release
# Binary quedará en target/release/dh-p2p
# Usage: dh-p2p -p 11554:554 <SERIAL>
```

### Opción 3 — Fallback: Imou Cloud
Si el cliente tiene cuenta Imou con el serial asociado, usar `imou-stream-manager` que ya genera URLs HLS sin tocar P2P.

## Limpiar proceso bloqueado

```bash
sudo pkill -f "main.py.*<SERIAL>"
sudo systemctl restart dh-p2p@dh-<alias>
```

## Verificar device está P2P Online

Desde app DMSS en móvil, buscar el serial. Si aparece como "Offline" → el equipo perdió conexión a la nube Dahua. No hay nada que VPS pueda hacer — el equipo debe recuperar conectividad LAN.
