# Auditoría Integral — Registro ISUP/Platform Access

**Fecha:** 2026-04-13 18:34 UTC
**VPS:** 18.230.40.6 (aionseg.co) — ip-172-31-8-215
**Uptime:** 17 días | **RAM:** 11.6 GB disponible de 15.8 GB | **Disco /opt:** 167 GB libre

---

## Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| Dispositivos esperados | **17** (8 Hikvision + 9 Dahua) |
| Funcionales (via workaround) | **12** |
| Degradados | **1** (DNXVR002) |
| Offline / Sin conectividad | **2** (PPNVR001, PEDVR001) |
| No configurados | **1** (LBXVR001) |
| Estado indeterminado | **1** (SCDVR001 parcial) |
| Hallazgos CRITICOS | **6** |
| Hallazgos ALTOS | **4** |
| Hallazgos MEDIOS | **3** |

### Hallazgo Principal

**El reverse-gateway en Go NUNCA fue desplegado.** El schema PostgreSQL `reverse.*` no existe. La infraestructura de registro funciona con un **stub en Python** (`device-platform-server.py`) que acepta conexiones pero NO establece sesiones SDK, NO autentica, y NO habilita streaming reverso.

El streaming real opera via **workarounds**:
- **Hikvision:** `hik_pull` (binario ISUP) conecta SALIENTE al WAN IP de cada dispositivo vía puertos NAT (8000/8010/8020/8030)
- **Dahua:** IMOU P2P HLS vía cloud relay de Dahua (`cmgw-online-vg.imoulife.com`)

---

## Estado por Dispositivo

### Hikvision (ISUP 5.0, puerto 7660)

| # | Sitio | Device ID | WAN IP | Registro | Streaming | Estado |
|---|---|---|---|---|---|---|
| 1 | Altagracia | AGDVR001 | 181.205.175.18 | Online | hik_pull (24+1 ch) | FUNCIONAL |
| 2 | Altos del Rosario | ARDVR001 | 190.159.37.188 | Online | hik_pull (16 ch) | FUNCIONAL |
| 3 | Pisquines | PQDVR001 | 181.205.202.122 | Online | hik_pull (16 ch) | FUNCIONAL |
| 4 | Pisquines | PQNVR001 | 181.205.202.122 | Online | hik_pull (16 ch) | FUNCIONAL |
| 5 | San Sebastian | SSDVR001 | 186.97.106.252 | Online | hik_pull (16 ch) | FUNCIONAL |
| 6 | Portal Plaza | PPNVR001 | desconocido | No registrado | Ninguno | OFFLINE |
| 7 | Senderos | SCDVR001 | 38.9.217.12 | No registrado* | hik_pull (8 ch) | PARCIAL |
| 8 | Portalegre | PEDVR001 | desconocido | desconocido | Ninguno | NO CONFIG |

*SCDVR001: hik_pull funciona pero el dispositivo no registra inbound en el platform-server.

### Dahua (Active Registration, puerto 7681)

| # | Sitio | Device ID | S/N | Streams go2rtc | Metodo | Estado |
|---|---|---|---|---|---|---|
| 9 | Terrabamba | TBXVR001 | BB01B89PAJ5DDCD | 19 ch | IMOU P2P | FUNCIONAL |
| 10 | Quintas Sta Maria | QSXVR001 | AH1020EPAZ39E67 | 8 ch | IMOU P2P | FUNCIONAL |
| 11 | Danubios (Clave) | DNXVR001 | AJ00421PAZF2E60 | 9 ch | IMOU P2P | FUNCIONAL |
| 12 | Danubios (Puesto) | DNXVR002 | AH0306CPAZ5EA1A | 0 ch | Ninguno | DEGRADADO |
| 13 | Terrazzino | TZXVR001 | AL02505PAJ638AA | 18 ch | IMOU P2P | FUNCIONAL |
| 14 | Hospital S. Jeronimo | HSXVR001 | AE01C60PAZA4D94 | 16 ch | IMOU P2P | FUNCIONAL |
| 15 | Alborada 9-10 | ABXVR001 | AL02505PAJD40E7 | 14 ch | IMOU P2P | FUNCIONAL |
| 16 | Patio Bonito | PBXVR001 | AL02505PAJDC6A4 | 12 ch | IMOU P2P | FUNCIONAL |
| 17 | Lubeck | LBXVR001 | desconocido | 0 ch | Ninguno | NO CONFIG |

### Dispositivos extra (NO en manifiesto de 17)

| Sitio | Vendor | WAN IP | Metodo | Estado |
|---|---|---|---|---|
| Torre Lucia (DVR+NVR) | Hikvision | 181.205.215.210 | hik_pull (24 ch) | FUNCIONAL |
| Brescia (LPR+XVR) | HIK+Dahua | 186.97.104.202 | hik_pull + IMOU P2P (18 ch) | FUNCIONAL |

---

## Infraestructura del VPS

### Puertos de Registro

| Puerto | Protocolo | Estado | Proceso | Nota |
|---|---|---|---|---|
| 7660 | TCP | ESCUCHANDO | python3 device-platform-server.py | Stub, no SDK |
| 7661 | UDP | NO ESCUCHANDO | — | Go gateway no desplegado |
| 7681 | TCP | ESCUCHANDO | python3 device-platform-server.py | Stub, no SDK |

### Firewall (UFW)

| Puerto | Estado | Nota |
|---|---|---|
| 7660/tcp | ALLOW | Regla 21 |
| 7681/tcp | ALLOW | Regla 22 |
| 7661/udp | **NO EN REGLAS** | Bloquearia ISUP media si se desplegara gateway |
| 3000 | DENY | API protegida vía nginx |
| 1984/tcp | DENY | go2rtc solo interno |

### Servicios PM2 (22 procesos)

| Servicio | Estado | Uptime | Restarts | RAM |
|---|---|---|---|---|
| aionseg-api | online | 14h | **14** | 200 MB |
| aion-vh-orchestrator | online | 82m | 0 | 63 MB |
| aion-vh-bridge | online | 14h | 0 | 63 MB |
| platform-server | online | 7d | 0 | 20 MB |
| hik-monitor | online | 3d | 0 | 83 MB |
| isapi-alerts | online | 3d | 0 | 64 MB |
| detection-worker | online | 3d | 0 | 101 MB |
| snap-dahua | online | 10d | 2 | 22 MB |
| snap-* (x11) | online | 11d | 0 | ~3.5 MB c/u |

**Ausentes:** aion-reverse-gateway, dahua-monitor, edge-gateway

### go2rtc

- **116 streams** configurados (todos con prefijo `da-*` para Dahua IMOU P2P)
- **0 streams `rv_*`** (reverse-gateway nunca desplegado)
- **0 streams Hikvision** en go2rtc (se usa hik_pull independiente)

---

## Hallazgos Criticos

### F01 — Go reverse-gateway nunca desplegado
El binario Go en `reverse-gateway/` existe en el repo pero nunca fue compilado/instalado en el VPS. El schema PostgreSQL `reverse.*` (devices, sessions, streams, routes, etc.) no fue migrado. Toda la arquitectura de sesiones SDK, credenciales cifradas con KEK, y streaming reverso es inoperante.

### F02 — Platform-server es un stub sin funcionalidad real
`device-platform-server.py` acepta conexiones TCP en 7660/7681, lee los primeros 8KB del handshake, extrae IP y (falla en extraer) serial, y guarda en un archivo JSON plano. NO autentica con ISUP key, NO establece sesión SDK, NO habilita streaming reverso. Los device IDs (AGDVR001, etc.) nunca se capturan.

### F03 — Streaming via workarounds fragiles
- **Hikvision:** `hik_pull` depende de NAT port-forwarding en cada sitio (puertos 8000-8030). Si el ISP cambia la IP publica o el router pierde la config NAT, se pierde conectividad.
- **Dahua:** IMOU P2P HLS depende del cloud de Dahua. Los tokens HLS tienen timestamps de marzo 2026 y pueden expirar.

### F04 — Credenciales en texto plano en procesos y configs
Los procesos `hik_pull` exponen `admin/Clave.seg2023` y `admin/seg12345` en la linea de comandos visible via `ps aux`. Cualquier usuario del VPS puede leerlas. Los archivos go2rtc.yaml contienen URLs IMOU con tokens.

### F05 — Backend API inestable (14 restarts en 14h)
`aionseg-api` ha reiniciado 14 veces. Requiere investigacion de logs para determinar causa (memory leak, excepciones no manejadas, OOM).

### F06 — Puerto UDP 7661 no en firewall
Si se desplegara el Go reverse-gateway, el transporte de media ISUP (UDP 7661) seria bloqueado por UFW. Regla faltante.

---

## Hallazgos Altos

### F07 — LBXVR001 (Lubeck) completamente sin configurar
Cero streams, cero registros, serial desconocido. El dispositivo nunca fue onboarded.

### F08 — DNXVR002 (Danubios Puesto) sin streams dedicados
Solo existe `da-danubios-ch*` (9 canales) que probablemente cubre solo DNXVR001. DNXVR002 con credenciales distintas no tiene streams IMOU P2P propios.

### F09 — PEDVR001 (Portalegre) sin configuracion de streaming
No hay proceso snap, no hay streams go2rtc. WAN IP desconocida. Podria ser una de las 3 IPs Hikvision no identificadas.

### F10 — PPNVR001 (Portal Plaza) offline confirmado
Sin registro, sin snap, sin streams. Problema de conectividad del sitio conocido.

---

## Hallazgos Medios

### F11 — 3 registros Dahua espurios desde IPs AWS
IPs 3.143.x.x, 3.134.x.x, 3.129.x.x registradas como dispositivos Dahua. Son escaneres de puertos.

### F12 — Tokens IMOU P2P HLS pueden expirar
URLs con timestamps de 2026-03-31 y 2026-04-02. Necesitan mecanismo de renovacion.

### F13 — 3 registros Hikvision no identificados
IPs 181.143.16.170, 200.58.214.114, 181.205.249.130 registraron en platform-server pero no tienen procesos snap asociados.

---

## Top 5 Acciones Recomendadas (por prioridad)

1. **Investigar y estabilizar aionseg-api** — 14 restarts indican un problema activo. Revisar `pm2 logs aionseg-api --lines 500`.

2. **Desplegar el Go reverse-gateway** o **decidir oficialmente que se mantiene la arquitectura de workarounds** (hik_pull + IMOU P2P). Si se mantienen los workarounds, documentar como arquitectura oficial y eliminar el codigo del reverse-gateway del repo.

3. **Configurar LBXVR001 (Lubeck)** — Obtener serial IMOU, generar tokens P2P HLS, agregar streams a go2rtc.yaml.

4. **Configurar DNXVR002 (Danubios Puesto)** — Generar tokens IMOU P2P HLS separados usando serial AH0306CPAZ5EA1A y credenciales CLAVE/Clave.seg2023.

5. **Proteger credenciales** — Mover passwords de lineas de comando hik_pull a archivos de configuracion con permisos 600. Implementar renovacion automatica de tokens IMOU.

---

## Conexiones Activas al Momento de la Auditoría

### Registros en platform-server (19 total)

**Hikvision online (7):**
| IP | Ultimo registro | Sitio probable |
|---|---|---|
| 181.205.175.18 | 18:37:28 | Altagracia |
| 181.205.202.122 | 18:37:36 | Pisquines |
| 186.97.106.252 | 18:37:33 | San Sebastian |
| 190.159.37.188 | 18:37:36 | Altos del Rosario |
| 181.205.215.210 | 18:37:39 | Torre Lucia (extra) |
| 181.143.16.170 | 18:37:40 | **NO IDENTIFICADO** |
| 200.58.214.114 | 18:37:40 | **NO IDENTIFICADO** |

**Nota:** hik-181.205.249.130 tambien registrado online pero no listado arriba por espacio.

**Dahua online (9):**
| IP | Ultimo registro | Sitio probable |
|---|---|---|
| 186.97.104.202 | 18:37:32 | Brescia (extra) |
| 138.84.41.88 | 18:37:34 | por identificar |
| 181.132.238.112 | 18:37:35 | por identificar |
| 191.89.104.34 | 18:37:35 | por identificar |
| 138.84.41.218 | 18:37:35 | por identificar |
| 167.0.161.94 | 18:37:40 | por identificar |
| 179.15.101.188 | 18:37:40 | por identificar |
| 190.249.146.255 | 18:37:42 | por identificar |
| 181.78.65.218 | 18:37:42 | por identificar |

**Dahua offline (3 — IPs AWS, probables escaneres):**
3.143.162.210, 3.134.216.108, 3.129.187.38

---

*Generado automaticamente por AION Audit Collector v1.0.0*
*Archivo de datos: audit_data.json | Playbook: remediation_playbook.md*
