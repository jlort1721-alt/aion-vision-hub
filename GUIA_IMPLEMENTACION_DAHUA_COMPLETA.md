# GUIA COMPLETA — Implementacion Dahua XVR/NVR en AION

**Fecha:** 2026-04-06
**Plataforma:** AION (aionseg.co)
**VPS:** 18.230.40.6 (Ubuntu, go2rtc 1.9.4)

---

## ESTADO ACTUAL (Validado en VPS)

### Lo que YA funciona:

| Componente | Estado | Detalle |
|-----------|--------|---------|
| go2rtc DVRIP | **FUNCIONAL** | Protocolo `dvrip://` soportado nativamente |
| Brescia | **17 streams activos** | Via RTSP directo a IP publica 186.97.104.202 |
| Santana (test) | **Configurado** | Via `dvrip://admin:Clave.seg2023@AB081E4PAZD6D5B` |
| IMOU Cloud API | **Configurado** | App ID/Secret en .env, endpoints /imou/* |
| IMOU Event Poller | **Activo** | Pollea alarmas cada 60s |
| Dahua Remote Access | **Funcional** | Snapshot, PTZ, door control, reboot via HTTP CGI |
| Dahua Event Normalizer | **15+ tipos** | VideoMotion, VideoLoss, SmartMotion, etc. |
| IMOU Stream Manager | **Escrito, NO activo** | Existe el codigo pero no se inicia en app.ts |
| Hikvision | **204 streams** | Todos funcionando con RTSP + H.264 transcoding |

### Lo que FALTA:

| Item | Estado |
|------|--------|
| Streams de 6 XVR restantes | Solo Brescia tiene streams |
| Tablas dahua_devices/channels/events en BD | No existen |
| Columna imou_device_id en devices | No existe en migracion |
| H.264 transcoding en streams Dahua | Brescia usa `#video=copy` (no transcode) |

---

## ARQUITECTURA FINAL (Lo que go2rtc ya soporta)

go2rtc tiene 3 formas de conectar Dahua XVR sin CMS custom:

### Opcion 1: RTSP directo (requiere IP publica o VPN)
```
rtsp://admin:pass@IP_PUBLICA:PUERTO/cam/realmonitor?channel=N&subtype=0
```
- **Brescia ya usa esto** (IP 186.97.104.202, port forwarding en MikroTik)
- Requiere abrir puerto RTSP en el router de cada sede
- Latencia mas baja, mejor calidad

### Opcion 2: DVRIP via IMOU P2P (sin IP publica, sin port forwarding)
```
dvrip://admin:pass@SERIAL_NUMBER
```
- **Santana ya usa esto** como test
- go2rtc resuelve el serial number via la red P2P de IMOU
- NO requiere IP publica ni port forwarding
- Funciona con el XVR detras de cualquier NAT
- Requiere que P2P/IMOU este habilitado en el XVR

### Opcion 3: CMS Auto Register (puerto 8000)
```
dvrip://admin:pass@SERIAL_NUMBER?port=8000
```
- Requiere implementar servidor CMS custom
- **NO recomendado** — go2rtc ya resuelve por P2P sin necesidad de esto

---

## PLAN DE IMPLEMENTACION

### Paso 1: Agregar los 6 XVR faltantes a go2rtc

Los streams se agregan al archivo `/etc/go2rtc/go2rtc.yaml` en la seccion `streams:`.

**Formato para cada canal:**
```yaml
# Formato DVRIP (sin IP publica — via IMOU P2P)
da-{sede}-ch{N}: dvrip://admin:{password}@{SERIAL}?channel={N}&subtype=0
```

**Para transcodificar a H.264 (compatibilidad con navegadores):**
```yaml
da-{sede}-ch{N}: ffmpeg:dvrip://admin:{password}@{SERIAL}?channel={N}&subtype=0#video=h264
```

### Dispositivos a configurar:

| ID | Sede | Serial | Canales | Password | Metodo |
|----|------|--------|---------|----------|--------|
| 01 | Factory | 9B02D09PAZ4C0D2 | 4 | Clave.seg2023 | DVRIP P2P |
| 02 | Quintas SM | AH1020EPAZ39E67 | 8 | Clave.seg2023 | DVRIP P2P |
| 03 | Terrazzino | AL02505PAJ638AA | 16 | Clave.seg2023 | DVRIP P2P |
| 04 | Danubios | AJ00421PAZF2E60 | 16 | Clave.seg2023 | DVRIP P2P |
| 05 | Terrabamba | BB01B89PAJ5DDCD | 32 | Clave.seg2023 | DVRIP P2P |
| 06 | Patio Bonito | AL02505PAJDC6A4 | 16 | Clave.seg2023 | DVRIP P2P |
| -- | Brescia | AK01E46PAZ0BA9C | 16 | Clave.seg2023 | YA FUNCIONA (RTSP) |
| -- | Santana | AB081E4PAZD6D5B | -- | Clave.seg2023 | YA CONFIGURADO (test) |

---

## CONFIGURACION EN CADA XVR

### Requisito previo: P2P debe estar HABILITADO

Para que `dvrip://` funcione via serial number, el XVR necesita tener P2P/IMOU habilitado.
Esto ya deberia estar activo si el XVR se registró alguna vez en IMOU Cloud.

**Verificar en cada XVR:**
```
Menu Principal → RED → P2P (o Easy4IP / DMSS Cloud)
  → Enable: SI (debe estar activado)
  → Estado: Online / Conectado
```

**Si P2P no esta activado:**
```
1. RED → P2P → Enable → SI
2. Esperar 30 segundos
3. Verificar que diga "Online" o "Connected"
4. Si no conecta: verificar que el XVR tiene internet (ping 8.8.8.8)
```

### Configuracion del codec H.264

**En cada XVR, cambiar el codec de todos los canales a H.264:**
```
Menu Principal → CAMARA → ENCODE (o CODIFICAR)
  → Canal: cada canal (1 al max)
  → Main Stream:
    → Video Compression: H.264 (NO H.265)
    → Resolution: 1080P (o la maxima del canal)
    → Frame Rate: 15 fps (recomendado para WAN)
    → Bit Rate Type: VBR
    → Bit Rate: 2048 Kbps
  → Sub Stream:
    → Video Compression: H.264
    → Resolution: D1 o 720P
    → Frame Rate: 10 fps
    → Bit Rate: 512 Kbps
  → Apply
```

**Porque H.264 y no H.265:**
- H.264 es compatible con todos los navegadores (Chrome, Firefox, Safari)
- H.265 requiere transcodificacion en el servidor (usa CPU)
- go2rtc puede hacer passthrough de H.264 sin CPU adicional
- WebRTC solo soporta H.264 nativamente

---

## CONFIGURACION EN EL VPS (go2rtc)

### Agregar streams al config

```bash
# Conectar al VPS
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6

# Editar config de go2rtc
sudo nano /etc/go2rtc/go2rtc.yaml
```

**Agregar estas lineas en la seccion `streams:`:**

```yaml
  # ═══ DAHUA XVR — VIA DVRIP P2P ═══

  # Factory (4 canales)
  da-factory-ch1: dvrip://admin:Clave.seg2023@9B02D09PAZ4C0D2?channel=1&subtype=0
  da-factory-ch2: dvrip://admin:Clave.seg2023@9B02D09PAZ4C0D2?channel=2&subtype=0
  da-factory-ch3: dvrip://admin:Clave.seg2023@9B02D09PAZ4C0D2?channel=3&subtype=0
  da-factory-ch4: dvrip://admin:Clave.seg2023@9B02D09PAZ4C0D2?channel=4&subtype=0

  # Quintas SM (8 canales)
  da-quintas-ch1: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=1&subtype=0
  da-quintas-ch2: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=2&subtype=0
  da-quintas-ch3: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=3&subtype=0
  da-quintas-ch4: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=4&subtype=0
  da-quintas-ch5: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=5&subtype=0
  da-quintas-ch6: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=6&subtype=0
  da-quintas-ch7: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=7&subtype=0
  da-quintas-ch8: dvrip://admin:Clave.seg2023@AH1020EPAZ39E67?channel=8&subtype=0

  # Terrazzino (16 canales)
  da-terrazzino-ch1: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=1&subtype=0
  da-terrazzino-ch2: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=2&subtype=0
  da-terrazzino-ch3: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=3&subtype=0
  da-terrazzino-ch4: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=4&subtype=0
  da-terrazzino-ch5: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=5&subtype=0
  da-terrazzino-ch6: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=6&subtype=0
  da-terrazzino-ch7: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=7&subtype=0
  da-terrazzino-ch8: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=8&subtype=0
  da-terrazzino-ch9: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=9&subtype=0
  da-terrazzino-ch10: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=10&subtype=0
  da-terrazzino-ch11: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=11&subtype=0
  da-terrazzino-ch12: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=12&subtype=0
  da-terrazzino-ch13: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=13&subtype=0
  da-terrazzino-ch14: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=14&subtype=0
  da-terrazzino-ch15: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=15&subtype=0
  da-terrazzino-ch16: dvrip://admin:Clave.seg2023@AL02505PAJ638AA?channel=16&subtype=0

  # Danubios Clave (16 canales)
  da-danubios-ch1: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=1&subtype=0
  da-danubios-ch2: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=2&subtype=0
  da-danubios-ch3: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=3&subtype=0
  da-danubios-ch4: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=4&subtype=0
  da-danubios-ch5: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=5&subtype=0
  da-danubios-ch6: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=6&subtype=0
  da-danubios-ch7: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=7&subtype=0
  da-danubios-ch8: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=8&subtype=0
  da-danubios-ch9: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=9&subtype=0
  da-danubios-ch10: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=10&subtype=0
  da-danubios-ch11: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=11&subtype=0
  da-danubios-ch12: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=12&subtype=0
  da-danubios-ch13: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=13&subtype=0
  da-danubios-ch14: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=14&subtype=0
  da-danubios-ch15: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=15&subtype=0
  da-danubios-ch16: dvrip://admin:Clave.seg2023@AJ00421PAZF2E60?channel=16&subtype=0

  # Terrabamba NVR (32 canales — agregar solo los activos)
  da-terrabamba-ch1: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=1&subtype=0
  da-terrabamba-ch2: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=2&subtype=0
  da-terrabamba-ch3: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=3&subtype=0
  da-terrabamba-ch4: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=4&subtype=0
  da-terrabamba-ch5: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=5&subtype=0
  da-terrabamba-ch6: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=6&subtype=0
  da-terrabamba-ch7: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=7&subtype=0
  da-terrabamba-ch8: dvrip://admin:Clave.seg2023@BB01B89PAJ5DDCD?channel=8&subtype=0

  # Patio Bonito (16 canales)
  da-pbonito-ch1: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=1&subtype=0
  da-pbonito-ch2: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=2&subtype=0
  da-pbonito-ch3: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=3&subtype=0
  da-pbonito-ch4: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=4&subtype=0
  da-pbonito-ch5: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=5&subtype=0
  da-pbonito-ch6: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=6&subtype=0
  da-pbonito-ch7: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=7&subtype=0
  da-pbonito-ch8: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=8&subtype=0
  da-pbonito-ch9: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=9&subtype=0
  da-pbonito-ch10: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=10&subtype=0
  da-pbonito-ch11: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=11&subtype=0
  da-pbonito-ch12: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=12&subtype=0
  da-pbonito-ch13: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=13&subtype=0
  da-pbonito-ch14: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=14&subtype=0
  da-pbonito-ch15: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=15&subtype=0
  da-pbonito-ch16: dvrip://admin:Clave.seg2023@AL02505PAJDC6A4?channel=16&subtype=0
```

### Reiniciar go2rtc

```bash
sudo systemctl restart go2rtc
# Esperar 10 segundos
sleep 10
# Verificar
curl -s http://localhost:1984/api/streams | python3 -c '
import sys,json
d=json.load(sys.stdin)
dahua=[k for k in d if k.startswith("da-")]
print(f"Total Dahua streams: {len(dahua)}")
'
```

---

## VERIFICACION POR SEDE

Despues de agregar los streams, verificar cada XVR:

```bash
# Verificar un stream especifico
curl -s "http://localhost:1984/api/stream?src=da-factory-ch1" | python3 -m json.tool

# Ver el stream en el navegador (WebRTC)
# Abrir: http://18.230.40.6:1984/stream.html?src=da-factory-ch1

# Verificar todos los streams Dahua
curl -s http://localhost:1984/api/streams | python3 -c '
import sys,json
d=json.load(sys.stdin)
for k in sorted(d):
  if k.startswith("da-"):
    v=d[k]
    prods=v.get("producers",[])
    status = "ACTIVE" if prods else "IDLE"
    print(f"  {status}  {k}")
'
```

### Checklist por sede:

```
SEDE: ________________
[ ] Streams agregados al go2rtc.yaml
[ ] go2rtc reiniciado
[ ] Al menos 1 canal responde en /api/stream?src=da-{sede}-ch1
[ ] Video visible en stream.html
[ ] XVR tiene P2P habilitado
[ ] XVR tiene codec H.264 en todos los canales
```

---

## HIKVISION — CAMBIAR A H.264

Para los 204 streams Hikvision que ya funcionan, cambiar el codec a H.264 en cada NVR/DVR:

### Via interfaz web del Hikvision:

```
1. Abrir navegador → http://IP_DEL_NVR
2. Login: admin / [password]
3. Configuration → Video/Audio
4. Para cada camara:
   → Main Stream:
     → Video Encoding: H.264
     → Resolution: 1920x1080 (o la maxima)
     → Frame Rate: 15 fps
     → Max Bitrate: 2048 Kbps
     → Video Quality: Higher
   → Sub Stream:
     → Video Encoding: H.264
     → Resolution: 704x576
     → Frame Rate: 10 fps
     → Max Bitrate: 512 Kbps
5. Save
```

### Via ISAPI (batch, desde el VPS):

```bash
# Para cada NVR Hikvision, cambiar codec de canal 1 main stream a H.264:
curl --digest -u admin:PASSWORD \
  -X PUT "http://IP_NVR/ISAPI/Streaming/channels/101" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<StreamingChannel>
  <id>101</id>
  <channelName>Camera 01</channelName>
  <Video>
    <videoCodecType>H.264</videoCodecType>
    <videoResolutionWidth>1920</videoResolutionWidth>
    <videoResolutionHeight>1080</videoResolutionHeight>
    <maxFrameRate>1500</maxFrameRate>
    <videoQualityControlType>VBR</videoQualityControlType>
    <fixedQuality>80</fixedQuality>
    <vbrUpperCap>2048</vbrUpperCap>
  </Video>
</StreamingChannel>'
```

**Canal ID format Hikvision:**
- `101` = Canal 1, Main Stream
- `102` = Canal 1, Sub Stream
- `201` = Canal 2, Main Stream
- etc.

---

## TROUBLESHOOTING

### Stream DVRIP no conecta:

1. **Verificar que P2P esta activo en el XVR**
   ```
   XVR Menu → RED → P2P → Enable: SI, Estado: Online
   ```

2. **Verificar serial number**
   ```
   XVR Menu → SISTEMA → INFO → Serial Number
   Debe coincidir con el usado en go2rtc.yaml
   ```

3. **Verificar password**
   ```
   Si la password del XVR cambio, actualizar en go2rtc.yaml
   ```

4. **Verificar internet del XVR**
   ```
   XVR Menu → RED → TCP/IP → Verificar gateway y DNS
   ```

5. **Test directo desde VPS**
   ```bash
   # Probar conexion DVRIP
   curl -s "http://localhost:1984/api/stream?src=dvrip://admin:pass@SERIAL"
   ```

### Stream se ve pixelado o con lag:

1. Cambiar a sub stream (menor calidad, menos ancho de banda):
   ```yaml
   da-sede-ch1: dvrip://admin:pass@SERIAL?channel=1&subtype=1
   ```

2. Reducir bitrate en el XVR:
   ```
   CAMARA → ENCODE → Main Stream → Bit Rate: 1024 Kbps
   ```

### go2rtc usa mucho CPU:

1. Si los streams son H.265 y go2rtc transcode a H.264, usa CPU.
   Solucion: cambiar codec en el XVR a H.264 nativo.

2. Usar `#video=copy` para passthrough sin transcoding:
   ```yaml
   da-sede-ch1: dvrip://admin:pass@SERIAL?channel=1&subtype=0#video=copy
   ```

---

## RESUMEN

| Concepto | Valor |
|----------|-------|
| Metodo de conexion | `dvrip://` via IMOU P2P (go2rtc nativo) |
| NO se necesita | CMS custom, puerto 8000, Dahua NetSDK, WireGuard |
| Config file | `/etc/go2rtc/go2rtc.yaml` |
| Restart | `sudo systemctl restart go2rtc` |
| Verificacion | `http://18.230.40.6:1984/stream.html?src=da-{sede}-ch{N}` |
| Total streams | 108 canales Dahua + 204 Hikvision = 312 streams |
| Codec recomendado | H.264 en todos los XVR/NVR |

*Guia generada para Clave Seguridad CTA — AION Platform — Abril 2026*
