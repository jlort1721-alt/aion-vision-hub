# Plan de Configuración — 35 dispositivos del inventario

**Fecha:** 2026-04-17
**Fuente:** `~/Downloads/AION_inventario_dispositivos.xlsx`
**Estado:** 27/35 registrados (77%), 8 faltan, 3 inconsistencias

---

## 1. Resumen del inventario

| Categoría | Cant. | Protocolo | Modo conexión |
|---|---|---|---|
| Hikvision NVR/DVR | 13 | ISAPI / HCNetSDK | IP pública + puerto |
| Hikvision Control Acceso | 9 | ISAPI AccessControl | IP pública + puerto |
| Dahua NVR/DVR | 13 | Dahua NetSDK / RPC | P2P (número de serie) |
| **TOTAL** | **35** | | |

### IPs multi-tenant (compartidas por puerto)

- `181.205.215.210` → 6 servicios (**Cluster Torre Lucia**): NVR, DVR + 4 controles acceso
- `181.205.202.122` → 4 servicios
- `200.58.214.114` → 2 servicios (Portalegre)
- `181.143.16.170` → 2 servicios (San Nicolas)
- `186.97.106.252` → 2 servicios (San Sebastian)

---

## 2. Estado actual por dispositivo

### 2.1 Hikvision NVR/DVR (13 — 12 registrados)

| Inv ID | Sitio | IP:Puerto | Estado DB | Observación |
|---|---|---|---|---|
| hk-portalegre-1 | Portalegre 1 | 200.58.214.114:8040 | ✅ DVR Portalegre | OK |
| hk-portalegre-2 | Portalegre 2 | 200.58.214.114:8000 | ✅ NVR Portalegre | OK |
| hk-palencia | Palencia | 181.205.249.130:8000 | ✅ DVR La Palencia | OK |
| **hk-portal-plaza** | **Portal Plaza** | **201.184.242.66:8040** | ❌ **FALTA** | IP única en inventario |
| hk-altos-rosario | Altos Rosario | 190.159.37.188:8010 | ✅ DVR Altos Rosario | OK |
| hk-san-nicolas | San Nicolas | 181.143.16.170:8000 | ✅ NVR San Nicolas | OK |
| hk-pisquines-1 | Pisquines 1 | 181.205.202.122:8010 | ✅ NVR Pisquines | ⚠️ puerto colisión con `ac-portalegre` |
| hk-pisquines-2 | Pisquines 2 | 181.205.202.122:8020 | ✅ DVR Pisquines | OK |
| hk-altagracia | Altagracia | 181.205.175.18:8030 | ✅ DVR Altagracia | OK |
| hk-torre-lucia-nvr | Torre Lucia NVR | 181.205.215.210:8010 | ✅ DVR Torre Lucia | ⚠️ nombre invertido DB vs inv |
| hk-torre-lucia-dvr | Torre Lucia DVR | 181.205.215.210:8020 | ✅ NVR Torre Lucia | ⚠️ nombre invertido DB vs inv |
| hk-san-sebastian | San Sebastian | 186.97.106.252:8000 | ✅ DVR San Sebastian | OK |
| hk-senderos-calanzans | Senderos Calanzans | 38.9.217.12:8030 | ✅ DVR Senderos | OK |

### 2.2 Controles Acceso Hikvision (9 — 8 registrados)

| Inv ID | Sitio | IP:Puerto | Estado DB | Observación |
|---|---|---|---|---|
| ac-brescia | AC Brescia | 186.97.104.202:8050 | ✅ | OK |
| ac-gym-tl | AC Gym Torre Lucia | 181.205.215.210:8040 | ✅ | OK |
| ac-norte-tl | AC Norte Torre Lucia | 181.205.215.210:8081 | ✅ | OK |
| ac-pisquines | AC Pisquines | 181.205.202.122:8000 | ✅ | OK |
| **ac-portalegre** | **AC Portalegre** | **181.205.202.122:8010** | ⚠️ **COLISIÓN** con `hk-pisquines-1` (misma IP:puerto) |
| ac-san-nicolas | AC San Nicolas | 181.143.16.170:8050 | ✅ | OK |
| **ac-san-sebastian** | **AC San Sebastian** | **186.97.106.252:8081** | ❌ **FALTA** (DB tiene en 8080, port diff) |
| ac-sur-tl | AC Sur Torre Lucia | 181.205.215.210:8060 | ✅ | OK |
| ac-ter-tl | AC Terraza Torre Lucia | 181.205.215.210:8070 | ✅ | OK |

### 2.3 Dahua P2P NVR/DVR (13 — 7 registrados)

| Inv ID | Sitio | Serial | Estado DB | Observación |
|---|---|---|---|---|
| **dh-arrezo-1** | **Arrezo** | `7J09E39PAZ0A972` | ❌ **FALTA** | user: `aion`, pass: `Seg2025.` |
| **dh-arrezo-2** | **Arrezo 2** | `7M042B3PAZ52776` | ❌ **FALTA** | user: `AION`, pass: `Seg2025.` |
| **dh-arrezo-3** | **Arrezo 3** | `7J0A254PAZ0A589` | ❌ **FALTA** | user: `admin`, pass: `Seg2025.` |
| dh-hsj | Hospital San Jeronimo | `AE01C60PAZA4D94` | ✅ XVR Clave | brand NULL |
| **dh-terrazino** | **Terrazino** | `AL02505PAJ638AA` | ❌ **FALTA** | |
| dh-quintas-sm | Quintas SM | `AH1020EPAZ39E67` | ✅ XVR Clave | brand NULL |
| **dh-lubeck** | **Lubeck** | `AE09E09PAZ5E3F4` | ❌ **FALTA** | |
| dh-danubios-2 | Danubios 2 | `AH0306CPAZ5EA1A` | ✅ XVR Puesto | brand NULL |
| dh-danubios-1 | Danubios 1 | `AJ00421PAZF2E60` | ✅ XVR Clave | brand NULL |
| **dh-terrabamba** | **Terrabamba** | `BB01B89PAJ5DDCD` | ❌ **FALTA** | |
| dh-patio-bonito | Patio Bonito | `AL02505PAJDC6A4` | ✅ XVR Clave | brand NULL |
| dh-brescia | Brescia | `AK01E46PAZ0BA9C` | ✅ XVR | brand NULL |
| dh-alborada | Alborada | `AL02505PAJD40E7` | ✅ XVR Clave | brand NULL |

---

## 3. Inconsistencias que requieren decisión

### I1. Puerto 8010 colisión en 181.205.202.122

Inventario dice que en `181.205.202.122:8010` están **dos** dispositivos:
- `hk-pisquines-1` (NVR Hikvision)
- `ac-portalegre` (Control Acceso Hikvision)

**Imposible técnicamente**: un puerto TCP no puede servir dos servicios distintos.

**Acciones posibles:**
- A) `ac-portalegre` realmente está en otro puerto (validar con el XLSX original o el operador).
- B) Hay un router/NAT con redirecciones y el 8010 externo va a dos dispositivos internos distintos (raro).
- C) Uno de los dos fue decomisionado y el inventario no lo refleja.

**Decisión propuesta:** mantener `hk-pisquines-1` (ya registrado + validado con conexiones activas desde `hik_pull`) y marcar `ac-portalegre` como **"pending-port-verification"** hasta recibir puerto correcto.

### I2. ac-san-sebastian puerto 8081 vs DB 8080

Inventario: `186.97.106.252:8081`
DB actual: `186.97.106.252:8080` (nombre "AC San Sebastian")

**Decisión:** son el mismo dispositivo con typo en el inventario O en la DB. Hacer test TCP al :8081 y al :8080 para decidir cuál responde. Aplicar el correcto.

### I3. hk-torre-lucia nombres invertidos

Inventario:
- `hk-torre-lucia-nvr` @ 8010
- `hk-torre-lucia-dvr` @ 8020

DB:
- DVR Torre Lucia @ 8010
- NVR Torre Lucia @ 8020

**Decisión:** nombres en DB son confiables (fueron registrados con acceso real al firmware). Actualizar nombres en inventario XLSX, no en DB.

---

## 4. Plan de configuración — 100% funcional

### FASE A — Seguridad de credenciales (30 min)

**No commitear contraseñas al repo.** Guardar en vault seguro del VPS.

```bash
ssh aion-vps '
  sudo mkdir -p /etc/aion/secrets
  sudo chmod 700 /etc/aion/secrets
  sudo chown root:root /etc/aion/secrets

  # Archivo con credenciales por dispositivo, perms 600
  sudo -u root tee /etc/aion/secrets/device-credentials.env > /dev/null <<EOF
# Hikvision / Access Control (password común: Clave.seg2023; excepciones: seg12345)
HIK_DEFAULT_USER=admin
HIK_DEFAULT_PASS=Clave.seg2023
HIK_PASS_SEG12345=seg12345

# Dahua P2P (password: Clave.seg2023; excepción Arrezo: Seg2025.)
DH_DEFAULT_USER=admin
DH_DEFAULT_PASS=Clave.seg2023
DH_ARREZO_PASS=Seg2025.
EOF
  sudo chmod 600 /etc/aion/secrets/device-credentials.env
'
```

Backend y workers leerán de aquí (via systemd EnvironmentFile o docker secret). No entra al git.

### FASE B — Registrar los 8 dispositivos faltantes (1-2h)

#### B.1 Hikvision faltante: hk-portal-plaza

```sql
-- En aionseg_prod, como superuser
INSERT INTO sites (id, name, tenant_id, created_at)
  SELECT gen_random_uuid(), 'Portal Plaza', 'a0000000-0000-0000-0000-000000000001', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Portal Plaza')
  RETURNING id \gset site_portal_plaza
;

INSERT INTO devices (
  id, tenant_id, site_id, name, type, brand, ip_address, port, rtsp_port,
  status, channels, tags, created_at
) VALUES (
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  (SELECT id FROM sites WHERE name = 'Portal Plaza'),
  'NVR Portal Plaza',
  'nvr',
  'hikvision',
  '201.184.242.66',
  8040,
  554,
  'unknown',
  16,  -- asumir 16 canales, ajustar tras descubrimiento ISAPI
  ARRAY['residencial', 'comercial', 'hk-portal-plaza'],
  NOW()
);
```

#### B.2 Control acceso faltante: ac-san-sebastian

1. Primero validar puerto real: `nc -z -w3 186.97.106.252 8081` y `nc -z -w3 186.97.106.252 8080`.
2. Según el que responda, insertar:

```sql
INSERT INTO devices (...) VALUES (
  ...,
  'AC San Sebastian',
  'access_control',
  'hikvision',
  '186.97.106.252',
  <puerto_correcto>,  -- 8080 u 8081 según test TCP
  ...
  ARRAY['access_control', 'ac-san-sebastian']
);
```

#### B.3 Dahua faltantes (6: arrezo-1/2/3, terrazino, lubeck, terrabamba)

Dahua P2P no usa IP/puerto sino **serial number**. Inserción:

```sql
-- Función helper para insertar Dahua P2P
CREATE OR REPLACE FUNCTION insert_dahua_p2p(
  p_name text, p_serial text, p_user text, p_pass_placeholder text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_site_id uuid;
  v_device_id uuid;
BEGIN
  INSERT INTO sites (id, name, tenant_id, created_at)
    VALUES (gen_random_uuid(), p_name, 'a0000000-0000-0000-0000-000000000001', NOW())
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_site_id;

  INSERT INTO devices (
    id, tenant_id, site_id, name, type, brand, serial_number,
    status, channels, tags, created_at
  ) VALUES (
    gen_random_uuid(),
    'a0000000-0000-0000-0000-000000000001',
    v_site_id,
    'XVR ' || p_name,
    'xvr',
    'dahua',
    p_serial,
    'unknown',
    16,
    ARRAY['dahua_p2p', 'inv:' || p_serial, 'user:' || p_user],
    NOW()
  )
  RETURNING id INTO v_device_id;

  RETURN v_device_id;
END $$;

-- Ejecutar
SELECT insert_dahua_p2p('Arrezo',     '7J09E39PAZ0A972', 'aion',  'DH_ARREZO_PASS');
SELECT insert_dahua_p2p('Arrezo 2',   '7M042B3PAZ52776', 'AION',  'DH_ARREZO_PASS');
SELECT insert_dahua_p2p('Arrezo 3',   '7J0A254PAZ0A589', 'admin', 'DH_ARREZO_PASS');
SELECT insert_dahua_p2p('Terrazino',  'AL02505PAJ638AA', 'admin', 'DH_DEFAULT_PASS');
SELECT insert_dahua_p2p('Lubeck',     'AE09E09PAZ5E3F4', 'admin', 'DH_DEFAULT_PASS');
SELECT insert_dahua_p2p('Terrabamba', 'BB01B89PAJ5DDCD', 'admin', 'DH_DEFAULT_PASS');
```

#### B.4 Normalizar brand = 'dahua' en 7 existentes

```sql
UPDATE devices SET brand = 'dahua'
WHERE brand IS NULL
  AND serial_number IN (
    'AE01C60PAZA4D94','AH1020EPAZ39E67','AH0306CPAZ5EA1A',
    'AJ00421PAZF2E60','AL02505PAJDC6A4','AK01E46PAZ0BA9C','AL02505PAJD40E7'
  );
```

### FASE C — Conectividad por dispositivo (2-3h, se puede paralelizar)

Para cada dispositivo, ejecutar ciclo de validación (script en [aion/scripts/device-onboard.sh](../../aion/scripts/device-onboard.sh)):

#### Para Hikvision IP/NVR/DVR:
1. **TCP probe:** `nc -z -w5 $IP $PORT` → OK / TIMEOUT
2. **ISAPI auth:** `curl -u admin:$PASS -s "http://$IP:$PORT/ISAPI/System/deviceInfo"` → XML con device info
3. **Descubrir canales:** `curl -u admin:$PASS "http://$IP:$PORT/ISAPI/Streaming/channels"` → lista de canales
4. **Registrar cada canal en `cameras`:**
   ```sql
   INSERT INTO cameras (device_id, channel_number, name, stream_key, brand, tenant_id)
   VALUES ($device_id, $ch, '$site ch$ch', '$device_id_$ch', 'hikvision', $tenant);
   ```
5. **Añadir stream a go2rtc:**
   ```yaml
   streams:
     $stream_key: rtsp://admin:$PASS@$IP:554/Streaming/Channels/${ch}01
   ```

#### Para Dahua P2P:
1. Usar **Dahua Cloud SDK** (C/Python) con serial+user+pass
2. El worker `native-device-bridge` ya tiene lógica P2P: validar en logs PM2
3. Registrar en go2rtc vía RTSP local que expone el bridge:
   ```yaml
   streams:
     dh-arrezo-1-ch0: rtsp://127.0.0.1:<port_bridge>/$serial_ch0
   ```

#### Para Controles Acceso Hikvision:
1. **ISAPI AccessControl endpoints:**
   - `GET /ISAPI/AccessControl/doorStatus` → estado de puerta
   - `POST /ISAPI/AccessControl/RemoteControl/door/$id` → abrir/cerrar
   - `GET /ISAPI/AccessControl/CardInfo/Search` → listar credenciales
   - Subscripción eventos: `ISAPI/Event/notification/alertStream`
2. **Registrar puerta en `access_doors`:**
   ```sql
   INSERT INTO access_doors (site_id, is_active) VALUES ($site, true);
   ```

### FASE D — Grabaciones (ELEGIR UNA opción, 1 día)

**Opción 1 — Pull de grabaciones desde DVR** (RECOMENDADA, 0 storage VPS):
- Los DVRs ya graban localmente en sus HDDs
- On-demand: la plataforma consulta ISAPI playback endpoint cuando operador pide grabación histórica
- Endpoint Hikvision: `GET /ISAPI/ContentMgmt/search` + `GET /Streaming/tracks/$ch02?starttime=&endtime=`
- Endpoint Dahua: RPC `mediaFileFind.create` + `mediaFileFind.findFile`
- **Implementación:** nuevo endpoint backend `/api/recordings/playback?device=$id&from=$ts&to=$ts` que proxya al DVR.

**Opción 2 — Grabación continua en VPS con go2rtc** (si no hay NAS en DVR):
- Config go2rtc:
  ```yaml
  streams:
    hk-san-sebastian-ch1:
      - rtsp://...
      - ffmpeg:hk-san-sebastian-ch1#video=copy#audio=copy#record=/data/recordings/hk-san-sebastian/%Y-%m-%d/%H-%M.mp4
  ```
- Retention policy: limpiar >30 días con cron.
- Storage: **93 GB libre en /data** → ~10 cámaras × 7 días a 2Mbps = 150 GB (insuficiente para 100+ cámaras).

**Opción 3 — Push a MinIO** (escalable pero costoso):
- ffmpeg pipe → `mc pipe minio/aion-recordings/$device/$date.mp4`
- Lifecycle policy en bucket para retention.

### FASE E — Alarmas ISAPI fin-a-fin (1 día)

Estado actual: worker `isapi-alerts` online pero tabla `isapi_events` **no existe**.

1. **Crear tabla** (migración 038):
   ```sql
   CREATE TABLE IF NOT EXISTS isapi_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     device_id uuid REFERENCES devices(id),
     event_type text NOT NULL,  -- 'motion', 'linedetection', 'fielddetection', 'facedetection', etc.
     channel_id integer,
     timestamp timestamptz NOT NULL,
     raw_xml text,
     tenant_id uuid NOT NULL,
     correlation_id uuid,
     created_at timestamptz NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_isapi_events_device ON isapi_events(device_id, timestamp DESC);
   CREATE INDEX idx_isapi_events_type ON isapi_events(event_type);
   ```

2. **Cada NVR/DVR habilitar push ISAPI al VPS:**
   - Config Hikvision Web UI: `Configuration → Event → Basic Event → Motion Detection → Linkage Method → Upload to HTTP(S) server`
   - URL: `http://18.230.40.6:7660/isapi/event` (ya UFW permite 7660/tcp)
   - Credenciales: el DVR autenticará con user/pass que configuremos en el VPS

3. **Worker `isapi-alerts` lee esos POST, parse XML, INSERT a `isapi_events`.**

4. **Trigger `pg_notify` publica a MQTT** (event-gateway ya captura). Añadir `isapi_events` al CREATE TRIGGER en migración 039.

5. **Frontend suscribe a `aion/events/motion/*`** via WebSocket → muestra al operador.

### FASE F — Control de acceso operable (2 días)

1. **Backend endpoints** (módulo `modules/access-control/`):
   - `GET /api/access-doors` → listar puertas registradas (37 existentes + 1 nueva = 38)
   - `POST /api/access-doors/:id/open` → proxy ISAPI al controlador
   - `GET /api/access-doors/:id/history` → últimos 100 eventos
   - `POST /api/access-cards` → registrar tarjeta/biométrico
   - `POST /api/access-schedules` → horarios

2. **Frontend** (página nueva `/access-control`):
   - Lista de 38 puertas con estado en vivo (WebSocket `aion/events/door/*`)
   - Botón "Abrir" con confirmación + 2FA para admin
   - Timeline de accesos
   - Gestión de personas (1823 ya registradas)

3. **Worker `access-orchestrator`** (nuevo):
   - Suscribe ISAPI AccessControl event stream
   - Valida credencial vs `access_schedules`
   - Publica evento canónico `aion/events/access/*`
   - Emite comando `aion/commands/door/open` si operador acepta manual review

### FASE G — Video en vivo al loguear (0 trabajo — ya funciona, solo validar)

Cuando logueas en aionseg.co:
1. Frontend pide `GET /api/cameras?tenant_id=...` → lista de 353 cámaras
2. Para cada cámara visible: `<video src="https://aionseg.co/stream/$stream_key/index.m3u8">` → HLS desde go2rtc
3. go2rtc ya sirve 126 streams HLS → viewer ve video en <3s

**Validación post-configuración:** cuando registremos las 8 nuevas y se suban a go2rtc, contador pasará a ~140+ streams.

---

## 5. Requisitos externos (los tú haces)

| # | Requisito | Por qué |
|---|---|---|
| R1 | **Validar puerto real de `ac-san-sebastian`**: `nc -z 186.97.106.252 8080 && nc -z 186.97.106.252 8081` → decir cuál respondió | Inconsistencia inv vs DB |
| R2 | **Confirmar si hay 2 servicios en 181.205.202.122:8010** o es un error del XLSX | Físicamente imposible |
| R3 | **Habilitar ISAPI Event Upload en cada DVR Hikvision** (Web UI → Event → HTTP Upload) | Para que los DVR pushen alarmas al VPS |
| R4 | **Credenciales válidas** (las del XLSX se asumen correctas — si alguna falla, actualizar) | Obvio |
| R5 | **Decidir opción de grabación** (pull DVR / local VPS / MinIO push) | Cada una tiene trade-offs |
| R6 | **Si quieres grabación local continua**: expandir `/data` a 500GB (actual 100GB) O usar MinIO + retention 7d | Storage planning |

---

## 6. Plan de ejecución propuesto (orden cronológico)

```
[Hoy + 30 min]  FASE A     Seguridad credenciales (vault en /etc/aion/secrets/)
[Hoy + 2h]      FASE B     INSERT 8 dispositivos faltantes + fix brand Dahua
[Hoy + 3h]      FASE C.1   Validación TCP + ISAPI de 12 Hikvision + 8 Acceso
[Mañana]        FASE C.2   Validación P2P Dahua (13) via native-device-bridge
[Mañana]        FASE D     Implementar grabación (opción a decidir)
[Día 2]         FASE E     Alarmas ISAPI fin-a-fin (tabla + triggers + pushes)
[Día 3-4]       FASE F     Control de acceso (endpoints + frontend + worker)
[Día 4]         FASE G     Validación final login → video en vivo
```

---

## 7. Criterios de aceptación al 100% (sin fallas ni errores)

Al cerrar este plan, cuando Isabella loguee en aionseg.co debe ver:

- [ ] **35 dispositivos registrados** en `devices` (13 Hik + 9 Access + 13 Dahua).
- [ ] **353 + nuevas cámaras** en `cameras` tabla, todas con `last_seen < 5 min`.
- [ ] **Video en vivo** de cada cámara registrada (HLS, <3s TTFB).
- [ ] **Timeline de eventos** actualizándose en tiempo real (WebSocket → `aion/events/#`).
- [ ] **Alarmas motion/intrusion** llegan desde los DVR al frontend en <10s.
- [ ] **38 puertas** listadas en página `/access-control` con estado en vivo.
- [ ] **Apertura manual de puerta** funciona desde UI (con 2FA).
- [ ] **Grabación histórica** — operador elige fecha+hora y ve playback del DVR (opción 1) o VPS (opción 2).
- [ ] **Intercom bidireccional** funcionando (42 PJSIP → 0 fail en últimos 24h).
- [ ] **LPR** reporta placas detectadas en `lpr_events` (cámaras Brescia).
- [ ] **Face recognition** activa en cámaras configuradas.
- [ ] **Alertas Slack** llegando por cada evento `severity=high|critical`.
- [ ] **0 HTTP 500** en nginx access logs en últimas 24h.
- [ ] **Score plataforma 99/100** (ganando 1 punto por control de acceso operativo).

---

## 8. Qué **no** puedo garantizar sin que ocurra primero

| Feature | Bloqueo |
|---|---|
| Grabación de cámaras Dahua P2P | Dahua NetSDK debe estar instalado en VPS o worker funcional. Si `native-device-bridge` ya lo tiene, OK; si no, requiere compilar libdahuaSDK |
| LPR real en placas Colombia | OpenALPR detecta caracteres pero sin dataset colombiano la precisión es 60-75%. Pedir dataset interno |
| Control de acceso con biometría facial | Depende de capacidad del controlador físico (DS-K1T-series sí soporta) |
| Alertas WhatsApp a guardias | Twilio credencial rotada + `WHATSAPP_FROM` válido |

---

## 9. Commits planificados

- `feat(devices): register 8 missing devices from inventory XLSX`
- `fix(devices): normalize brand='dahua' on 7 P2P XVRs`
- `feat(access-control): endpoints + worker + frontend page`
- `feat(isapi-events): create table + triggers + push endpoint`
- `feat(recordings): implement opción elegida (pull/local/MinIO)`
- `docs(audit): device inventory reconciliation + onboarding runbook`

Cada uno con su gate de validación y rollback documentado.
