# Guía Completa de Configuración — Todos los Puestos AION

**Fecha:** 7 de abril de 2026
**Objetivo:** Llevar el 100% de las cámaras a video en vivo en aionseg.co/live-view
**Estado actual:** 191/312 online (61.2%) → Meta: 290+/312 (93%+)
**VPS:** 18.230.40.6 | go2rtc en puerto 1984 | 360 streams configurados

---

# PARTE 1 — DIAGNÓSTICO POR PUESTO

## Estado Actual de Todos los Puestos

| # | Puesto | Cámaras | Online | Marca | IP Pública | Protocolo | Estado |
|---|--------|---------|--------|-------|-----------|-----------|--------|
| 1 | Torre Lucia | 24 | 24 | Hikvision | 181.205.215.210 | RTSP :8010/:8020 | OK |
| 2 | San Nicolás | 17 | 17 | Hikvision | 181.143.16.170 | RTSP :8000/:8081 | OK |
| 3 | Alborada 9-10 | 1 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 4 | Brescia | 17 | 17 | Dahua | 186.97.104.202 | RTSP + IMOU | OK |
| 5 | Patio Bonito | 12 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 6 | Los Pisquines | 32 | 32 | Hikvision | 181.205.202.122 | RTSP :8010/:8020 | OK |
| 7 | San Sebastián | 16 | 16 | Hikvision | 186.97.106.252 | RTSP :8000 | OK |
| 8 | Terrabamba | 19 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 9 | Senderos Calasanz | 12 | 0 | Hikvision | 38.9.217.12 | RTSP :8030/:8020 | VERIFICAR |
| 10 | Altos del Rosario | 16 | 16 | Hikvision | 190.159.37.188 | RTSP :8010 | OK |
| 11 | Danubios | 9 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 12 | Terrazzino | 18 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 13 | Portal Plaza | 0 | 0 | — | — | — | SIN CÁMARAS |
| 14 | Portalegre | 20 | 20 | Hikvision | 200.58.214.114 | RTSP :8000/:8040 | OK |
| 15 | Altagracia | 33 | 33 | Hikvision | 181.205.175.18 | RTSP :8030/:8010 | OK |
| 16 | Lubeck | 0 | 0 | — | — | — | SIN CÁMARAS |
| 17 | Aparta Casas | 0 | 0 | — | — | — | SIN CÁMARAS |
| 18 | Quintas Sta. María | 8 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 19 | Hospital S. Jerónimo | 16 | 0 | Hikvision/Dahua | Sin IP pública | Pendiente | PENDIENTE |
| 20 | Hotel Eutopiq/Factory | 0 | 0 | Dahua | — | — | SIN CÁMARAS |
| 21 | Santa Ana Caballeros | 7 | 0 | Dahua | Sin IP pública | Pendiente P2P | PENDIENTE |
| 22 | La Palencia | 16 | 16 | Hikvision | 181.205.249.130 | RTSP :8000 | OK |

**Resumen:** 9 OK | 8 PENDIENTES | 5 SIN CÁMARAS

---

# PARTE 2 — PUESTOS QUE YA FUNCIONAN (9 sitios, 191 cámaras)

Estos puestos ya tienen video en vivo. Solo necesitan verificar H.264 en substream.

### 2.1 Verificar H.264 en Substream (TODOS los DVR/NVR Hikvision)

Para cada DVR/NVR, acceder vía web browser:

```
http://{IP_PUBLICA}:{PUERTO_MAPEADO}
Usuario: admin
Contraseña: (la del equipo)
```

1. Ir a **Configuration → Video/Audio**
2. Para CADA cámara/canal:
   - Seleccionar **Sub Stream**
   - **Video Encoding:** Cambiar a **H.264**
   - **Resolution:** CIF o 352×288
   - **Bitrate Type:** Variable
   - **Max Bitrate:** 512 Kbps
   - **Frame Rate:** 15 fps
3. Click **Save**

| Puesto | IP:Puerto de acceso web |
|--------|------------------------|
| Torre Lucia DVR | 181.205.215.210:8010 |
| Torre Lucia NVR | 181.205.215.210:8020 |
| San Nicolás NVR | 181.143.16.170:8000 |
| San Nicolás LPR | 181.143.16.170:8081 |
| Los Pisquines NVR | 181.205.202.122:8010 |
| Los Pisquines DVR | 181.205.202.122:8020 |
| San Sebastián DVR | 186.97.106.252:8000 |
| Altos Rosario DVR | 190.159.37.188:8010 |
| Portalegre NVR | 200.58.214.114:8000 |
| Portalegre DVR | 200.58.214.114:8040 |
| Altagracia DVR | 181.205.175.18:8030 |
| Altagracia LPR | 181.205.175.18:8010 |
| La Palencia DVR | 181.205.249.130:8000 |

**Tiempo estimado:** 3-5 minutos por DVR/NVR × 13 equipos = **45-65 minutos**

### 2.2 Verificar H.264 en Dahua (Brescia)

Acceder al XVR Dahua de Brescia:
```
http://186.97.104.202:{puerto_web}
```

1. **Setup → Camera → Encode**
2. Sub Stream → **H.264**
3. Resolution: CIF
4. Bitrate: 512 Kbps
5. Save

**Tiempo estimado:** 5 minutos

---

# PARTE 3 — PUESTOS PENDIENTES (8 sitios, 102 cámaras)

## 3.1 Puestos Dahua sin IP Pública — Solución DVRIP P2P

go2rtc soporta nativamente el protocolo DVRIP para dispositivos Dahua. La conexión es directa P2P usando el serial del equipo.

### Formato de URL en go2rtc:

```yaml
# Para cada canal del XVR Dahua:
nombre-canal-1:
  - dvrip://admin:password@serial.local:37777?channel=0&subtype=1
```

**IMPORTANTE:** El protocolo `dvrip://` de go2rtc necesita que el XVR tenga habilitado:
- P2P/Cloud activado
- Puerto TCP 37777 accesible (dentro de la red local está OK)

### Si el XVR NO tiene IP pública, las opciones son:

**Opción A — IMOU Cloud API (ya implementada para snapshots):**
- Snapshots ya funcionan via `snap-dahua` service
- Para video en vivo se necesita el stream P2P
- go2rtc soporta: `dvrip://serial_number` si el equipo tiene P2P habilitado

**Opción B — Port Forwarding en el router del sitio:**
- Mapear puerto externo → puerto 554 (RTSP) y 37777 (DVRIP) del XVR
- Requiere acceso al router de cada sitio
- Esta es la solución más confiable para video en vivo

**Opción C — VPN/Túnel (más complejo):**
- Instalar agente VPN en cada sitio
- El VPS se conecta a la red local del sitio
- Mayor complejidad, requiere equipo adicional

### Recomendación: Opción B (Port Forwarding) es la más viable

Para cada sitio Dahua sin IP pública, se necesita:

1. **Acceder al router del sitio** (MikroTik, TP-Link, etc.)
2. **Crear regla de port forwarding:**
   - Puerto externo: Elegir uno único (ej: 8554 para RTSP, 37777 para DVRIP)
   - IP interna: La IP LAN del XVR (ej: 192.168.1.108)
   - Puerto interno: 554 (RTSP) y 37777 (DVRIP)
3. **Verificar que la IP pública del sitio es estática o tiene DDNS**

### Configuración por Puesto Dahua Pendiente:

#### 3. Alborada 9-10 (1 cámara)
- **Equipo:** Dahua XVR 8ch
- **Serial:** AL02505PAJD40E7
- **Tarea:** Habilitar P2P en el XVR, configurar DVRIP en go2rtc
- **En el XVR:** Setup → Network → P2P → Enable
- **En go2rtc (VPS):**
```yaml
alborada-ch1:
  - dvrip://admin:contraseña@{IP_PUBLICA}:37777?channel=0&subtype=1
```

#### 5. Patio Bonito (12 cámaras)
- **Equipo:** Dahua XVR 8ch (verificar si hay 2 unidades)
- **Serial:** AL02505PAJDC6A4
- **Tarea:** Port forwarding en router + DVRIP en go2rtc
- **Puertos a mapear:** RTSP 554→554, DVRIP 37777→37777

#### 8. Terrabamba (19 cámaras)
- **Equipo:** Dahua XVR 32ch
- **Serial:** BB01B89PAJ5DDCD
- **Tarea:** Port forwarding + configurar 19 canales en go2rtc

#### 11. Danubios (9 cámaras, 2 XVR)
- **Equipo 1:** Dahua XVR 8ch — Serial: AJ00421PAZF2E60
- **Equipo 2:** Dahua XVR 8ch — Serial: AH0306CPAZ5EA1A
- **Tarea:** Port forwarding para ambos XVR (puertos diferentes)

#### 12. Terrazzino (18 cámaras)
- **Equipo:** Dahua XVR 16ch
- **Serial:** AL02505PAJ638AA
- **Tarea:** Port forwarding + 16 canales en go2rtc

#### 18. Quintas de Santa María (8 cámaras)
- **Equipo:** Dahua XVR 8ch
- **Serial:** AH1020EPAZ39E67
- **Tarea:** Port forwarding + 8 canales en go2rtc

#### 21. Santa Ana de los Caballeros (7 cámaras)
- **Equipo:** Dahua XVR 8ch
- **Serial:** Pendiente de verificar en sitio
- **Tarea:** Verificar serial, port forwarding + 7 canales

## 3.2 Puestos Hikvision Offline

#### 9. Senderos de Calasanz (12 cámaras)
- **IP Pública:** 38.9.217.12
- **Equipos:** DVR1 8ch (:8030) + DVR2 4ch (:8020)
- **Estado:** IP existe pero cámaras aparecen offline
- **Diagnóstico:** Verificar que port forwarding está activo
- **Test:**
```bash
curl -s --connect-timeout 5 http://38.9.217.12:8030
curl -s --connect-timeout 5 http://38.9.217.12:8020
```
- Si no responde: Verificar con operadora si el port forwarding está activo en el router

#### 19. Hospital San Jerónimo (16 cámaras)
- **Marca:** Verificar en sitio (puede ser Hikvision o Dahua)
- **IP Pública:** Sin IP pública reportada
- **Tarea:** Verificar equipo, configurar port forwarding o ISUP

---

# PARTE 4 — PORT FORWARDING: QUÉ REDIRECCIONAR

## Regla General por DVR/NVR

| Puerto | Protocolo | Servicio | Necesario para |
|--------|-----------|----------|----------------|
| 554 | TCP | RTSP | Video en vivo (go2rtc) |
| 80/443 | TCP | HTTP/HTTPS | Acceso web al DVR |
| 8000 | TCP | SDK/Hik-Connect | Gestión Hikvision |
| 37777 | TCP | DVRIP | Video Dahua (go2rtc) |
| 37778 | TCP | Dahua HTTP | Web Dahua |
| 5060 | UDP | SIP | Citofonia (si aplica) |

## Para que el VPS controle la red del sitio

Agregar una regla de port forwarding que apunte al router del sitio:

| Puerto Externo | IP Interna | Puerto Interno | Uso |
|---------------|------------|----------------|-----|
| 8080 | 192.168.1.1 | 80 | Acceso web al router desde VPS |
| 8443 | 192.168.1.1 | 443 | HTTPS del router |

Así desde el VPS se puede acceder:
```bash
# Acceder al router del sitio desde el VPS:
curl http://{IP_PUBLICA_SITIO}:8080
```

**IMPORTANTE:** Cambiar la contraseña del router a algo seguro y diferente para cada sitio.

## Esquema de Puertos Recomendado por Sitio

Para evitar conflictos, usar un esquema consistente:

| Dispositivo | Puerto RTSP | Puerto Web | Puerto SDK/DVRIP |
|-------------|-------------|------------|-----------------|
| DVR/NVR #1 | 554 | 80 | 8000 (Hik) / 37777 (Dahua) |
| DVR/NVR #2 | 1554 | 81 | 8001 / 37778 |
| DVR/NVR #3 | 2554 | 82 | 8002 / 37779 |
| Router | 8080 | — | — |

---

# PARTE 5 — CONFIGURACIÓN H.264 PASO A PASO

## 5.1 Hikvision (DVR/NVR/XVR)

```
1. Abrir navegador → http://{IP}:{PUERTO}
2. Login: admin / {contraseña}
3. Ir a: Configuration → Video/Audio
4. Seleccionar Sub Stream (Sub-flujo)
5. Para CADA canal:
   - Video Encoding: H.264
   - Resolution: CIF (352×288) o QCIF (176×144)
   - Video Quality: Medium
   - Frame Rate: 15 fps
   - Max Bitrate: 512 Kbps
   - Bitrate Type: Variable
6. Click Save (Guardar)
7. Repetir para todos los canales
```

## 5.2 Dahua (XVR/DVR)

```
1. Abrir navegador → http://{IP}:{PUERTO}
2. Login: admin / {contraseña}
3. Ir a: Setup → Camera → Encode (Codificación)
4. Seleccionar pestaña: Sub Stream (Extra Stream)
5. Para CADA canal:
   - Encode Mode: H.264
   - Resolution: CIF
   - Frame Rate: 15 fps
   - Bit Rate Type: VBR
   - Bit Rate: 512 Kbps
6. Click Save (Guardar)
7. Repetir para todos los canales
```

## 5.3 Verificar desde el VPS

```bash
# Verificar codec de un stream:
ffprobe -v quiet -print_format json -show_streams \
  "rtsp://admin:password@{IP}:{RTSP_PORT}/Streaming/Channels/102" \
  2>/dev/null | grep codec_name

# Debe decir "h264", NO "hevc" ni "h265"
```

---

# PARTE 6 — CONFIGURACIÓN FANVIL (Teléfonos SIP)

## Modelo recomendado: Fanvil X3S/X3SG

### Paso 1: Acceder al teléfono
```
1. Ver IP del teléfono: Presionar botón OK en el teléfono
2. Abrir navegador → http://{IP_TELEFONO}
3. Login: admin / admin (cambiar después)
```

### Paso 2: Configurar cuenta SIP
```
1. Ir a: Line → SIP
2. Configurar:
   - Display Name: Puesto {Nombre del Sitio}
   - User Name: {extensión} (ej: 101)
   - Authentication Name: {extensión}
   - Authentication Password: {contraseña SIP}
   - SIP Server: 18.230.40.6
   - SIP Port: 5060
   - Transport: UDP
3. Save
```

### Paso 3: Auto-provisioning desde AION
```
1. Ir a: Auto Provision → Settings
2. Server URL: https://aionseg.co/api/provisioning/
3. Protocol: HTTPS
4. Interval: 3600 (1 hora)
5. Save y Apply
```

### Paso 4: Configurar codec de audio
```
1. Ir a: Line → SIP → Codec
2. Enabled codecs (en orden):
   - G.722 (HD)
   - G.711a (PCMA)
   - G.711u (PCMU)
3. Save
```

### Extensiones por puesto (Asterisk PBX):

| # | Puesto | Extensión | Contraseña SIP |
|---|--------|-----------|----------------|
| 1 | Torre Lucia | 101 | Ver Asterisk config |
| 2 | San Nicolás | 102 | Ver Asterisk config |
| 3 | Alborada 9-10 | 103 | Ver Asterisk config |
| 4 | Brescia | 104 | Ver Asterisk config |
| 5 | Patio Bonito | 105 | Ver Asterisk config |
| 6 | Los Pisquines | 106 | Ver Asterisk config |
| 7 | San Sebastián | 107 | Ver Asterisk config |
| 8 | Terrabamba | 108 | Ver Asterisk config |
| 9 | Senderos Calasanz | 109 | Ver Asterisk config |
| 10 | Altos Rosario | 110 | Ver Asterisk config |

Para ver las contraseñas:
```bash
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6
cat /etc/asterisk/pjsip_wizard.conf | grep -A5 "endpoint/"
```

---

# PARTE 7 — CAPACIDAD DEL VPS

## Estado actual

| Recurso | Disponible | Usado | Libre |
|---------|-----------|-------|-------|
| CPU | 4 vCPU | ~30% | 70% |
| RAM | 16 GB | 2.1 GB | 13.9 GB |
| Disco | 193 GB | 22 GB | 171 GB |
| go2rtc streams | 360 configurados | ~191 activos | 169 slots |

## Capacidad para video transcoding (H.265→H.264)

Cada stream con ffmpeg transcode consume:
- **CPU:** ~5-8% por stream transcoding
- **RAM:** ~30-50 MB por stream

Con 4 vCPU, el máximo de transcoding simultáneo es **~15-20 streams**.

## Recomendación

**Si TODOS los equipos tienen H.264 en substream, NO se necesita transcode.**

go2rtc en modo passthrough (sin transcode) consume:
- **CPU:** <1% por stream
- **RAM:** ~5 MB por stream
- **Capacidad:** 500+ streams sin problema

**Conclusión:** El VPS actual (t3.xlarge) es SUFICIENTE si los equipos transmiten en H.264. No necesita upgrade.

Si hay equipos que NO pueden cambiar a H.264 (firmware antiguo), considerar upgrade a t3.2xlarge (8 vCPU, 32 GB RAM) por ~$120 USD/mes adicionales.

---

# PARTE 8 — POR QUÉ NO SE VE VIDEO DAHUA EN LIVE VIEW

## Diagnóstico

Los equipos Dahua sin IP pública están configurados solo con IMOU Cloud API para **snapshots**. La plataforma muestra snapshots cada 3 segundos (no video real).

## Razón técnica

El frontend detecta cámaras con prefijo `ss-`, `ag-`, `pq-`, `tl-`, `se-`, `ar-`, `br-` y las fuerza a modo snapshot:

```javascript
const SDK_ONLY_PREFIXES = ['ss-', 'ag-', 'pq-', 'tl-', 'se-', 'ar-', 'br-'];
```

## Solución

1. **Configurar port forwarding** en el router de cada sitio Dahua → puerto RTSP 554 y DVRIP 37777
2. **Registrar streams en go2rtc** con la IP pública del sitio
3. **Actualizar el `stream_key`** de las cámaras en la DB para que NO tengan el prefijo SDK
4. El frontend automáticamente cargará video fMP4 en vez de snapshots

---

# PARTE 9 — RUTA DE TRABAJO 12 HORAS

## Preparación previa (la noche anterior)

- [ ] Imprimir esta guía
- [ ] Verificar acceso SSH al VPS
- [ ] Cargar laptop con browser y herramientas
- [ ] Llevar cable de red y adaptador

## Jornada de 12 horas (7:00 AM - 7:00 PM)

### Bloque 1: 7:00 - 8:30 (1.5h) — Central de Monitoreo + VPS

| Tarea | Tiempo |
|-------|--------|
| Verificar estado del VPS y go2rtc | 10 min |
| Revisar streams activos vs configurados | 10 min |
| Preparar scripts de test de conectividad | 10 min |
| Llamar a cada sitio pendiente para coordinar acceso | 30 min |
| Documentar IPs de routers y credenciales | 30 min |

### Bloque 2: 8:30 - 10:30 (2h) — H.264 Remoto (puestos con IP)

Desde la central, cambiar H.264 en substream de todos los equipos con IP pública:

| Puesto | Equipos | Tiempo est. |
|--------|---------|-------------|
| Torre Lucia (DVR+NVR) | 2 equipos × 5 min | 10 min |
| San Nicolás (NVR+LPR) | 2 equipos × 5 min | 10 min |
| Los Pisquines (NVR+DVR) | 2 equipos × 5 min | 10 min |
| San Sebastián (DVR) | 1 equipo × 5 min | 5 min |
| Altos Rosario (DVR) | 1 equipo × 5 min | 5 min |
| Portalegre (NVR+DVR) | 2 equipos × 5 min | 10 min |
| Altagracia (DVR+LPR) | 2 equipos × 5 min | 10 min |
| La Palencia (DVR) | 1 equipo × 5 min | 5 min |
| Brescia Dahua (XVR) | 1 equipo × 5 min | 5 min |
| **Subtotal** | **14 equipos** | **70 min** |
| Buffer + verificación | | 20 min |
| **Total Bloque 2** | | **90 min** |

### Bloque 3: 10:30 - 11:00 (30 min) — Verificar Senderos de Calasanz

```bash
# Desde el VPS, verificar conectividad:
curl -s --connect-timeout 5 http://38.9.217.12:8030
ffprobe -v quiet "rtsp://admin:pass@38.9.217.12:8030/Streaming/Channels/101"
```

- Si responde: Configurar H.264 + verificar streams
- Si no responde: Coordinar visita presencial o llamar al sitio

### Bloque 4: 11:00 - 12:30 (1.5h) — Almuerzo + Desplazamiento

Almorzar y desplazarse al primer sitio Dahua más cercano.

### Bloque 5: 12:30 - 3:00 (2.5h) — Sitios Dahua Cercanos (Medellín)

**Ruta optimizada por cercanía:**

| Orden | Puesto | Dirección | Tareas | Tiempo |
|-------|--------|-----------|--------|--------|
| 1 | Danubios | Cl. 47D #72-183, Laureles | Router + 2 XVR + H.264 | 30 min |
| 2 | Terrazzino | Cl. 22A Sur #46-34, Envigado | Router + XVR 16ch + H.264 | 25 min |
| 3 | Patio Bonito | Tv. 5A #45-163, Poblado | Router + XVR + H.264 | 25 min |
| Desplazamiento entre sitios | | | | 30 min |
| **Subtotal** | | | | **1h 50min** |

**En cada sitio Dahua:**
1. Acceder al router → crear port forwarding (RTSP 554, DVRIP 37777, Web 80)
2. Acceder al XVR → cambiar substream a H.264
3. Anotar IP pública del router (o verificar que tiene IP fija)
4. Verificar desde celular que el port forwarding funciona
5. Llamar a la central para que registren el stream en go2rtc

### Bloque 6: 3:00 - 5:00 (2h) — Sitios Dahua Lejanos

| Orden | Puesto | Dirección | Tareas | Tiempo |
|-------|--------|-----------|--------|--------|
| 4 | Santa Ana | Transversal 74 #2-15 | Router + XVR + H.264 | 25 min |
| 5 | Alborada 9-10 | Dg 93 #39-60 | Router + XVR + H.264 | 20 min |
| Desplazamiento | | | | 30 min |
| **Subtotal** | | | | **1h 15min** |

### Bloque 7: 5:00 - 6:00 (1h) — Sitios Fuera de Medellín (Coordinar)

Estos requieren visita separada o configuración remota con ayuda del operador:

| Puesto | Ubicación | Acción |
|--------|-----------|--------|
| Quintas Sta. María | San Jerónimo | Llamar operador, guiar config router por teléfono |
| Hospital S. Jerónimo | San Jerónimo | Mismo desplazamiento que Quintas |
| Terrabamba | Vía MDE-STA FÉ | Programar visita separada |

**Alternativa:** Si el operador del sitio tiene acceso al router, guiarlo por WhatsApp/videollamada.

### Bloque 8: 6:00 - 7:00 (1h) — Registro en VPS + Verificación

De vuelta en la central o remotamente:

| Tarea | Tiempo |
|-------|--------|
| SSH al VPS, agregar streams Dahua a go2rtc config | 20 min |
| Reiniciar go2rtc: `sudo systemctl restart go2rtc` | 2 min |
| Verificar cada stream nuevo en go2rtc admin | 15 min |
| Actualizar stream_keys en la DB (quitar prefijo SDK) | 10 min |
| Verificar en aionseg.co/live-view que muestra video | 10 min |
| Documentar resultados en bitácora | 3 min |

### Comando para agregar streams Dahua en VPS:

```bash
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6

# Editar config de go2rtc:
sudo nano /etc/go2rtc.yaml

# Agregar bajo "streams:":
#   danubios-ch1:
#     - rtsp://admin:password@{IP_PUBLICA_DANUBIOS}:554/cam/realmonitor?channel=1&subtype=1
#   danubios-ch2:
#     - rtsp://admin:password@{IP_PUBLICA_DANUBIOS}:554/cam/realmonitor?channel=2&subtype=1
#   ... etc para cada canal

# Reiniciar:
sudo systemctl restart go2rtc

# Verificar:
curl -s http://localhost:1984/api/streams | python3 -m json.tool | grep -c "producers"
```

---

# PARTE 10 — RESUMEN DE COSTOS Y MATERIALES

| Item | Cantidad | Notas |
|------|----------|-------|
| Transporte (gasolina/taxi) | 1 jornada | Ruta Medellín: Laureles → Envigado → Poblado |
| Cable de red (backup) | 1 × 3m | Por si necesita conectar directo al DVR |
| Laptop con browser | 1 | Chrome o Firefox actualizado |
| Celular con datos | 1 | Para verificar port forwarding externo |
| Credenciales impresas | 1 hoja | IPs, puertos, contraseñas de todos los equipos |

---

# PARTE 11 — CHECKLIST DE VERIFICACIÓN POST-CONFIGURACIÓN

Para cada sitio configurado, verificar:

- [ ] DVR/NVR accesible por web desde internet
- [ ] Substream en H.264 para TODOS los canales
- [ ] Stream RTSP funciona: `ffprobe rtsp://...`
- [ ] Stream registrado en go2rtc (aparece en /api/streams)
- [ ] Cámara aparece como "online" en aionseg.co/devices
- [ ] Video se muestra en aionseg.co/live-view (NO snapshot)
- [ ] Badge muestra "LIVE" (no "SNAP") en la cámara

---

**Documento generado por AION Platform — 7 de abril de 2026**
**Versión 1.0 — Guía operativa de campo**
