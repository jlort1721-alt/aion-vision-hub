# Runbook — Onboarding de nuevo dispositivo

Tiempo estimado: 5-10 min por equipo.

## Caso A — Hikvision NVR/DVR (IP pública + puerto)

### A.1 Registrar en DB

```sql
-- Conectado como postgres
INSERT INTO sites (id, tenant_id, name, created_at)
  SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Nombre Sitio', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Nombre Sitio');

INSERT INTO devices (id, tenant_id, site_id, name, type, brand, ip_address, port, rtsp_port, status, channels, tags, created_at)
VALUES (
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM sites WHERE name = 'Nombre Sitio'),
  'NVR Nombre Sitio',
  'nvr',  -- o 'dvr', 'access_control'
  'hikvision',
  '<IP_PUBLICA>',
  <PUERTO_SDK>,
  554,
  'unknown',
  <N_CANALES>,
  ARRAY['residencial', 'hk-<alias>'],
  NOW()
);
```

### A.2 Añadir a snap worker (snapshots)

```bash
ssh aion-vps
pm2 start /usr/local/bin/hik_batch_snap.sh --name snap-<alias> -- \
  <prefix>-ch <ip> <puerto> admin <password> 1 <num_ch> 1
pm2 save
```

### A.3 Añadir a go2rtc

Editar `/etc/go2rtc/go2rtc.yaml`:

```yaml
streams:
  <alias>-ch01: rtsp://admin:<pass>@<ip>:554/Streaming/Channels/101
  <alias>-ch02: rtsp://admin:<pass>@<ip>:554/Streaming/Channels/201
  # ... por canal
```

Luego: `sudo systemctl reload go2rtc`

### A.4 Configurar alarmas ISAPI remotas

Desde el VPS (sin ir a sitio):

```bash
cd /Users/ADMIN/Documents/open-view-hub-main/aion/scripts
sudo -E bash configure-hikvision-remote.sh --dry-run   # preview
sudo -E bash configure-hikvision-remote.sh             # apply
```

### A.5 Verificar ingest

```bash
# En 5 min debería llegar el primer push
ssh aion-vps 'sudo -u postgres psql aionseg_prod -tAc "SELECT count(*), max(created_at) FROM isapi_events"'
```

## Caso B — Dahua P2P (serial number)

### B.1 Registrar en DB

```sql
INSERT INTO devices (id, tenant_id, site_id, name, type, brand, serial_number, status, channels, tags, created_at)
VALUES (
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM sites WHERE name = 'Nombre Sitio'),
  'XVR Nombre Sitio',
  'xvr',
  'dahua',
  '<SERIAL_P2P>',
  'unknown',
  <N_CANALES>,
  ARRAY['residencial', 'dahua_p2p', 'dh-<alias>'],
  NOW()
);
```

### B.2 Opción B1 — Imou Cloud (si el cliente tiene cuenta)

- Requiere que serial esté asociado a la cuenta Imou del cliente.
- El worker `imou-stream-manager` automáticamente obtiene URLs HLS firmadas.
- Sin intervención adicional.

### B.3 Opción B2 — dh-p2p bridge

```bash
ssh aion-vps
# Añadir env
sudo tee /etc/aion/dh-p2p/dh-<alias>.env <<EOF
SERIAL=<SERIAL_P2P>
USERNAME=<user>
PASSWORD=<pass>
PORT=11567  # siguiente puerto libre
EOF
sudo chmod 600 /etc/aion/dh-p2p/dh-<alias>.env

# Habilitar servicio
sudo systemctl enable --now dh-p2p@dh-<alias>

# Verificar
sudo systemctl status dh-p2p@dh-<alias>
sudo journalctl -u dh-p2p@dh-<alias> -n 20
```

Luego añadir stream a go2rtc con `rtsp://<user>:<pass>@127.0.0.1:11567/cam/realmonitor?channel=1&subtype=0`.

## Caso C — Control de Acceso Hikvision

Mismo que Caso A, pero con:
- `type = 'access_control'`
- Crear `access_doors` row:

```sql
INSERT INTO access_doors (id, site_id, is_active)
VALUES (gen_random_uuid(), (SELECT id FROM sites WHERE name = '<sitio>'), true);
```

## Rollback

Si algo falla en cualquier paso:

```sql
BEGIN;
DELETE FROM devices WHERE ip_address = '<IP>' AND port = <PORT>;
-- Si es nuevo sitio y no tiene otros devices:
DELETE FROM sites WHERE name = '<NUEVO>' AND NOT EXISTS (SELECT 1 FROM devices WHERE site_id = sites.id);
COMMIT;
```

```bash
pm2 delete snap-<alias>
sudo systemctl disable --now dh-p2p@dh-<alias>
sudo rm /etc/aion/dh-p2p/dh-<alias>.env
# Editar /etc/go2rtc/go2rtc.yaml y remover streams
```
