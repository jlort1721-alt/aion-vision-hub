# Clave Seguridad — Guía de Integración de Dispositivos

> Guía paso a paso para integrar cámaras, NVR, citófonos, controles de acceso y dispositivos IoT
> Versión 1.0 — Marzo 2026

---

## 1. Cámaras IP

### 1.1 Hikvision

**Modelos probados**: DS-2CD2xx3, DS-2CD2xx5, DS-2CD4xx6, serie Turbo HD

**URLs RTSP**:
```
# Canal 1, stream principal
rtsp://usuario:contraseña@IP:554/Streaming/Channels/101

# Canal 1, substream (para mosaico)
rtsp://usuario:contraseña@IP:554/Streaming/Channels/102

# Canal 2 (NVR)
rtsp://usuario:contraseña@IP:554/Streaming/Channels/201
```

**Puertos estándar**:
| Puerto | Servicio |
|--------|----------|
| 554 | RTSP |
| 80 | Web / ISAPI |
| 8000 | SDK propietario |
| 443 | HTTPS |

**Registro en Clave Seguridad**:
1. Dispositivos → Agregar Dispositivo
2. Marca: Hikvision
3. IP: dirección LAN de la cámara
4. Puerto RTSP: 554
5. Puerto ONVIF: 80
6. Usuario/Contraseña: credenciales de la cámara
7. Probar Conexión

### 1.2 Dahua

**Modelos probados**: IPC-HDW, IPC-HFW, NVR4xx, XVR5xx

**URLs RTSP**:
```
# Canal 1, stream principal
rtsp://usuario:contraseña@IP:554/cam/realmonitor?channel=1&subtype=0

# Canal 1, substream
rtsp://usuario:contraseña@IP:554/cam/realmonitor?channel=1&subtype=1

# Canal N (NVR)
rtsp://usuario:contraseña@IP:554/cam/realmonitor?channel=N&subtype=0
```

**Puertos estándar**:
| Puerto | Servicio |
|--------|----------|
| 554 | RTSP |
| 80 | Web / CGI |
| 37777 | SDK propietario |
| 443 | HTTPS |

### 1.3 ONVIF Genérico

Para cualquier cámara compatible con ONVIF Profile S:

```
# La URL RTSP se obtiene automáticamente vía ONVIF GetStreamUri
# Puerto ONVIF típico: 80 o 8080
```

**Descubrimiento automático**:
Configurar `DISCOVERY_NETWORK_RANGE=192.168.1.0/24` y el sistema busca dispositivos ONVIF en la red.

### 1.4 NVR (Grabadores)

Para NVR Hikvision/Dahua, registrar el NVR como dispositivo con el número de canales. Cada canal se accede con el URL RTSP correspondiente al canal (101, 201, 301... para Hikvision; channel=1, channel=2... para Dahua).

---

## 2. Citófonos IP

### 2.1 Fanvil

**Modelos soportados**: i10, i12, i16, i18, i20, i23, i31, i33, X1, X3, X5, X7

**Configuración**:
1. Acceder al panel web del Fanvil: `http://IP_CITOFONO`
2. Configurar extensión SIP:
   - SIP Server: IP de la PBX
   - SIP User: extensión (ej: 100)
   - SIP Password: contraseña de la extensión
3. Configurar relay de puerta:
   - Door Settings → Output Duration: 3 segundos
   - Access Control → Door Relay: habilitado
4. En Clave Seguridad:
   - Citofonía IP → Agregar Dispositivo
   - Marca: Fanvil, Modelo: X5U
   - IP: dirección del citófono
   - URI SIP: sip:100@IP_PBX

**Apertura de puerta remota**:
```http
POST /api/v1/intercom/door/open
{
  "deviceId": "uuid-del-citofono",
  "duration": 3
}
```

### 2.2 Hikvision (Serie DS-KD)

**Modelos**: DS-KD8003, DS-KD8102, DS-KD3002

**Configuración**:
1. Acceder al panel web: `http://IP_CITOFONO`
2. Configurar SIP:
   - Network → SIP → Enable
   - SIP Server: IP de la PBX
   - User Number: extensión
3. Configurar relay:
   - Access Control → Door Station → Enable

### 2.3 Grandstream

**Modelos**: GDS3710, GDS3705, GDS3712

**Configuración similar a Fanvil**: Registrar como extensión SIP en la PBX, configurar relay de puerta.

---

## 3. PBX / Servidor SIP

### 3.1 FreePBX / Asterisk

**Requisitos**:
- FreePBX 16+ o Asterisk 18+
- ARI (Asterisk REST Interface) habilitado

**Configurar ARI**:
```ini
# /etc/asterisk/ari.conf
[general]
enabled=yes
pretty=yes

[clave]
type=user
read_only=no
password=mi_contraseña_ari
```

**En Clave Seguridad** (`backend/.env`):
```env
SIP_HOST=192.168.1.100
SIP_PORT=5060
SIP_ARI_URL=http://192.168.1.100:8088/ari
SIP_ARI_USERNAME=clave
SIP_ARI_PASSWORD=mi_contraseña_ari
```

### 3.2 3CX

Si se usa 3CX como PBX:
1. Configurar trunk SIP para la integración
2. Usar API de 3CX o SIP directo para las llamadas
3. Configurar extensiones para cada citófono

---

## 4. Dispositivos IoT / Domótica

### 4.1 Sonoff / eWeLink

**Dispositivos compatibles**:
- Sonoff Basic / Mini / TX series (interruptores)
- Sonoff S26 / S31 (enchufes)
- Sonoff 4CH (relé 4 canales)
- Sonoff TH (temperatura + humedad)
- Cualquier dispositivo compatible con eWeLink

**Configuración**:
1. Instalar app eWeLink en el teléfono
2. Vincular dispositivos Sonoff a la cuenta eWeLink
3. Registrar cuenta de desarrollador en dev.ewelink.cc
4. Obtener App ID y App Secret
5. En `backend/.env`:
   ```env
   EWELINK_APP_ID=tu_app_id
   EWELINK_APP_SECRET=tu_app_secret
   EWELINK_REGION=us
   ```
6. En la interfaz: Domóticos → Login eWeLink → Sincronizar

**Acciones disponibles**:
| Acción | Descripción |
|--------|-------------|
| on | Encender |
| off | Apagar |
| toggle | Cambiar estado |
| pulse | Encender por X segundos y apagar |

### 4.2 Relés de Control de Acceso

Para relés que controlan puertas, portones, luces:
1. Registrar como dispositivo domótico
2. Configurar IP y tipo de acción
3. Las acciones se ejecutan vía API HTTP del relé o vía eWeLink

---

## 5. Control de Acceso Físico

### 5.1 Controladores Hikvision (DS-K series)

- Integración vía ISAPI / protocolo Hikvision
- Control de puertas, lectores de tarjeta, biométricos
- Registro de eventos de acceso

### 5.2 Controladores Dahua (ASI series)

- Integración vía CGI / SDK Dahua
- Similar funcionalidad a Hikvision

### 5.3 Lectura de Placas (LPR)

- Cámaras LPR Hikvision o Dahua
- Eventos de placa detectada → comparación con base de datos de vehículos
- Acción automática: abrir barrera si placa autorizada

---

## 6. Requisitos de Red

### Red de Dispositivos

| Requisito | Descripción |
|-----------|-------------|
| IP fija | Cada dispositivo debe tener IP estática o DHCP reservado |
| VLAN | Recomendado: VLAN separada para cámaras |
| Ancho de banda | 4-8 Mbps por cámara (stream principal) |
| Latencia | < 100ms entre servidor y dispositivos |
| MTU | 1500 (estándar) |

### Puertos a Abrir (Firewall Interno)

| Puerto | Protocolo | Dirección | Uso |
|--------|-----------|-----------|-----|
| 554 | TCP | Server → Cámara | RTSP |
| 80/443 | TCP | Server → Cámara | Web/API |
| 8000/37777 | TCP | Server → Cámara | SDK propietario |
| 5060 | UDP/TCP | Bidireccional | SIP |
| 8088 | TCP | Server → PBX | ARI |

### Acceso Remoto a Cámaras

Para cámaras en sitios remotos:
1. **VPN**: Recomendado. Túnel VPN entre sitios.
2. **Port Forwarding**: Mapear puerto RTSP en el router del sitio remoto.
3. **Cloud P2P**: Usar servicio P2P del fabricante (Hik-Connect, DMSS).

---

## 7. Troubleshooting por Dispositivo

### Cámara no conecta

1. `ping IP_CAMARA` — verificar conectividad
2. Abrir `http://IP_CAMARA` — verificar panel web
3. Probar RTSP con VLC: `rtsp://user:pass@IP:554/...`
4. Verificar que el usuario tenga permisos RTSP habilitados
5. En Clave Seguridad: Dispositivos → Probar Conexión

### Citófono no registra en PBX

1. Verificar configuración SIP (server, usuario, contraseña)
2. Verificar que la extensión exista en la PBX
3. Revisar logs de la PBX: `asterisk -rx "sip show peers"`
4. Verificar firewall entre citófono y PBX (puerto 5060)

### eWeLink no sincroniza

1. Verificar credenciales de la cuenta eWeLink
2. Verificar que la región sea correcta (us/eu/as/cn)
3. Verificar que las credenciales de desarrollador sean válidas
4. En la interfaz: verificar estado de salud eWeLink

### Stream no se ve en Vista en Vivo

1. Verificar que MediaMTX esté corriendo: `docker compose ps`
2. Verificar que el stream esté registrado: `curl http://localhost:9997/v3/paths/list`
3. Probar HLS directo: `http://localhost:8888/nombre-stream/`
4. Verificar logs de MediaMTX: `docker compose logs clave-mediamtx`

---

## 8. Matriz de Compatibilidad

| Dispositivo | Video | PTZ | Audio | Acceso | Eventos | Estado |
|-------------|:-----:|:---:|:-----:|:------:|:-------:|:------:|
| Hikvision IP Camera | Si | Si | Si | — | Si | Producción |
| Hikvision NVR | Si | Via cámara | Si | — | Si | Producción |
| Hikvision DS-KD | Si | — | Si | Si | Si | Producción |
| Dahua IP Camera | Si | Si | Si | — | Si | Producción |
| Dahua NVR | Si | Via cámara | Si | — | Si | Producción |
| ONVIF Genérico | Si | Parcial | Parcial | — | Parcial | Producción |
| Fanvil X series | — | — | Si | Si | Si | Producción |
| Grandstream GDS | Si | — | Si | Si | Si | Beta |
| Sonoff / eWeLink | — | — | — | Si* | Si | Producción |

*Acceso: control de relé para puertas/portones.

---

*Guía de Integración de Dispositivos — Clave Seguridad v1.0 — Marzo 2026*
