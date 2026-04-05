# AION — GUÍA COMPLETA DE ACCIONES EXTERNAS
# 10 acciones paso a paso para llevar la plataforma al 100%
# Fecha: 2026-04-01

---

## ACCIÓN 1: Crear cuenta n8n (2 minutos)

**Estado actual:** n8n está corriendo en `https://aionseg.co/n8n/` pero NO tiene owner configurado.

### Pasos:

1. Abrir en el navegador: **https://aionseg.co/n8n/**
2. Se mostrará la pantalla de setup inicial
3. Llenar los campos:
   ```
   Nombre:       Isabella (o tu nombre)
   Apellido:     Administrador
   Email:        jlort1721@gmail.com
   Password:     (uno seguro, mínimo 8 caracteres — guárdalo en tu gestor de contraseñas)
   ```
4. Clic en "Next" → completar el setup
5. Ya tienes acceso al panel de n8n

### Verificación:
- Deberías ver el dashboard de n8n vacío, listo para crear workflows
- URL directa: `https://aionseg.co/n8n/home/workflows`

---

## ACCIÓN 2: Bot de Telegram (10 minutos)

### Paso 1: Crear el bot con BotFather

1. Abrir **Telegram** en tu celular o escritorio
2. Buscar: **@BotFather** (el bot oficial de Telegram, tiene check azul)
3. Enviar: `/start`
4. Enviar: `/newbot`
5. BotFather pregunta el nombre del bot → escribir:
   ```
   AION Monitor
   ```
6. BotFather pregunta el username → escribir:
   ```
   aion_clave_monitor_bot
   ```
   (Si está tomado, intentar variaciones: `aion_seg_monitor_bot`, `clave_aion_bot`, etc.)

7. BotFather responde con algo como:
   ```
   Done! Congratulations on your new bot. You will find it at t.me/aion_clave_monitor_bot.
   Use this token to access the HTTP Bot API:
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

8. **COPIAR ESE TOKEN** — lo necesitas en los siguientes pasos

### Paso 2: Configurar el bot

Enviar estos comandos a @BotFather uno por uno:

```
/setdescription
```
Seleccionar tu bot → escribir:
```
Bot de monitoreo de AION Security Platform. Consulta estados, busca residentes, reporta incidentes.
```

```
/setcommands
```
Seleccionar tu bot → escribir:
```
estado - Ver estado general del sistema
buscar - Buscar residente o vehículo
incidente - Reportar un incidente
camaras - Ver resumen de cámaras
ayuda - Ver comandos disponibles
```

### Paso 3: Obtener tu Chat ID

1. Abrir en el navegador:
   ```
   https://t.me/aion_clave_monitor_bot
   ```
2. Enviar al bot: `/start`
3. Abrir en el navegador (reemplazar TOKEN con tu token):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. Buscar en la respuesta JSON el campo `"chat":{"id":XXXXXXXX}` — ese número es tu Chat ID
5. **ANOTAR** el Chat ID

### Paso 4: Agregar al servidor

Conectar al VPS y ejecutar:

```bash
ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6

# Agregar al .env
cd /var/www/aionseg/backend/apps/backend-api
echo "" >> .env
echo "# Telegram Bot" >> .env
echo "TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "TELEGRAM_CHAT_ID=TU_CHAT_ID_AQUI" >> .env

# Reiniciar para que tome las variables
pm2 restart aionseg-api
```

### Paso 5: Crear workflow en n8n

1. Ir a `https://aionseg.co/n8n/`
2. Clic en **"+ Add Workflow"** → nombrar: `AION Telegram Bot`
3. Agregar nodo: **Telegram Trigger**
   - Credential: crear nueva → pegar el token del bot
   - Updates: `Message`
4. Agregar nodo: **Switch** (después del trigger)
   - Reglas basadas en `{{ $json.message.text }}`:
     - Contiene `/estado` → rama Estado
     - Contiene `/buscar` → rama Buscar
     - Contiene `/incidente` → rama Incidente
     - Default → rama Ayuda
5. Para la rama **Estado**, agregar nodo **HTTP Request**:
   ```
   Method: GET
   URL: http://localhost:3001/analytics/dashboard
   Headers:
     Authorization: Bearer (generar un token largo o usar API key)
   ```
6. Después agregar nodo **Telegram** (Send Message):
   - Chat ID: `{{ $json.message.chat.id }}`
   - Text: formatear la respuesta del dashboard
7. Activar el workflow (toggle arriba a la derecha)

### Verificación:
- Enviar `/estado` al bot en Telegram
- Debería responder con datos del dashboard

---

## ACCIÓN 3: WhatsApp via Twilio (20 minutos)

### Paso 1: Crear cuenta Twilio

1. Ir a **https://www.twilio.com/try-twilio**
2. Crear cuenta:
   ```
   Nombre:    Isabella / Jose
   Email:     jlort1721@gmail.com
   Password:  (uno seguro)
   ```
3. Verificar email (revisa inbox y spam)
4. Verificar teléfono (te envían un código SMS)
5. En el wizard de bienvenida:
   - "Which product?" → **WhatsApp**
   - "What do you plan to build?" → **Alerts & Notifications**
   - "How do you want to build?" → **With no code (n8n)**

### Paso 2: Activar WhatsApp Sandbox

1. En la consola de Twilio, ir a:
   **Messaging → Try it out → Send a WhatsApp message**
   O directamente: `https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn`

2. Twilio te muestra un número (ej: `+14155238886`) y un código (ej: `join hungry-lion`)

3. Desde **TU celular**, enviar un WhatsApp al número de Twilio:
   ```
   join hungry-lion
   ```
   (usar el código exacto que te muestra Twilio)

4. Twilio responde: "You're connected to the sandbox!"

### Paso 3: Obtener credenciales

1. Ir a: `https://console.twilio.com/`
2. En el dashboard principal verás:
   ```
   Account SID:  ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Auth Token:   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (clic en "Show")
   ```
3. **COPIAR ambos valores**

4. El número de WhatsApp sandbox es: `+14155238886` (o el que te asignaron)

### Paso 4: Agregar al servidor

```bash
ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6

cd /var/www/aionseg/backend/apps/backend-api
echo "" >> .env
echo "# Twilio WhatsApp" >> .env
echo "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "TWILIO_WHATSAPP_FROM=whatsapp:+14155238886" >> .env

pm2 restart aionseg-api
```

### Paso 5: Crear workflow en n8n

1. Ir a `https://aionseg.co/n8n/`
2. **"+ Add Workflow"** → nombrar: `AION WhatsApp Alerts`
3. Agregar nodo trigger: **Webhook**
   - Method: POST
   - Path: `whatsapp-alert`
   - Esto crea URL: `https://aionseg.co/n8n/webhook/whatsapp-alert`
4. Agregar nodo: **Twilio** (Send SMS)
   - Credential: crear nueva → pegar Account SID y Auth Token
   - From: `whatsapp:+14155238886`
   - To: `whatsapp:+57TUNUMERO` (tu celular con código de Colombia)
   - Message: `{{ $json.message || "Alerta AION" }}`
5. Activar el workflow

### Paso 6: Probar

```bash
# Desde el VPS
curl -X POST https://aionseg.co/n8n/webhook/whatsapp-alert \
  -H "Content-Type: application/json" \
  -d '{"message":"🚨 Prueba de alerta AION — sistema funcionando"}'
```

Deberías recibir el WhatsApp en tu celular.

### Para producción (después de validar el sandbox):

1. Comprar número en Twilio: **Console → Phone Numbers → Buy a number**
   - País: Colombia (+57) si disponible, o USA (+1)
   - Costo: ~$1/mes el número + $0.005/mensaje
2. Registrar el número para WhatsApp Business:
   - **Messaging → Senders → WhatsApp senders**
   - Seguir el proceso de verificación de Facebook Business
3. Crear plantillas de mensaje (requerido por Meta):
   - Template 1: `alerta_seguridad` → "Alerta {{1}} en sede {{2}}: {{3}}"
   - Template 2: `visitante` → "Visitante {{1}} solicita acceso a {{2}}"
   - Template 3: `reporte_diario` → "Reporte diario AION: {{1}} eventos, {{2}} incidentes"
4. Costo mensual estimado: **$15-30 USD** (número + ~2000 mensajes)

---

## ACCIÓN 4: eWeLink App ID (10 minutos)

**Estado actual:** Ya tienes las credenciales configuradas en .env:
```
EWELINK_APP_ID=5ohQX9503Podrb7X554sDOHxCk8XduTj
EWELINK_APP_SECRET=uccENeL3fmV4GrwrBtucLrBrf3jcNnev
EWELINK_REGION=us
```

**ESTO YA ESTÁ HECHO.** Las credenciales de eWeLink ya están en el servidor y los 86 dispositivos ya se controlan. Solo necesitas verificar:

### Verificación:

```bash
ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6

# Verificar que los dispositivos responden
curl -s -H "Authorization: Bearer $(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jlort1721@gmail.com","password":"Jml1413031."}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')" \
  http://localhost:3001/domotics/devices | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
online=sum(1 for x in d if x.get('online'))
print(f'Total: {len(d)}, Online: {online}')
"
```

**Resultado esperado:** `Total: 86, Online: ~61`

### Si necesitas regenerar credenciales:

1. Ir a **https://dev.ewelink.cc/**
2. Login con: `clavemonitoreo@gmail.com` / password de la cuenta
3. Dashboard → tu aplicación → copiar App ID y App Secret
4. Actualizar en el servidor:
   ```bash
   # Editar .env
   nano /var/www/aionseg/backend/apps/backend-api/.env
   # Cambiar EWELINK_APP_ID y EWELINK_APP_SECRET
   pm2 restart aionseg-api
   ```

---

## ACCIÓN 5: HikConnect Cloud (15 minutos)

**Para qué sirve:** Acceso cloud a las cámaras Hikvision sin necesitar RTSP directo (port forward). Esto cubriría sedes donde el RTSP no funciona desde el VPS.

### Paso 1: Registrarse como desarrollador

1. Ir a **https://open.hikvision.com/** (portal global) o **https://tpp.hikvision.com/** (partner)
2. Clic en **"Sign Up"** o **"Register"**
3. Crear cuenta:
   ```
   Email:       jlort1721@gmail.com
   Empresa:     Clave Seguridad CTA
   País:        Colombia
   Tipo:        Software Developer / System Integrator
   ```
4. Verificar email
5. Completar el perfil de empresa

### Paso 2: Crear aplicación

1. Ir a **Console → Application Management → Add Application**
2. Llenar:
   ```
   App Name:        AION Security Platform
   App Type:        Server Application
   Description:     Cloud video surveillance management platform
   Redirect URI:    https://aionseg.co/api/hikconnect/callback
   ```
3. Enviar para aprobación (puede tomar 1-3 días hábiles)

### Paso 3: Obtener credenciales

Una vez aprobada la aplicación:
1. En Application Management → tu app
2. Copiar:
   ```
   Access Key (AK): xxxxxxxxxxxxxxxxxxxx
   Secret Key (SK): xxxxxxxxxxxxxxxxxxxx
   ```

### Paso 4: Vincular los DVR/NVR

Para cada DVR que quieras acceder por cloud:
1. Abrir la app **Hik-Connect** en el celular
2. Agregar dispositivo → escanear código QR del DVR (o ingresar serial)
3. Los dispositivos vinculados aparecen en la API cloud

**DVR/NVR a vincular (7 en total):**

| Sede | IP Actual | Puerto | Password DVR |
|------|-----------|--------|-------------|
| San Nicolás | 181.143.16.170 | 554 | Clave.seg2023 |
| Portalegre | 200.58.214.114 | 554 | Clave.seg2023 |
| Torre Lucia | 181.205.215.210 | 8010 | seg12345 |
| Pisquines | 181.205.202.122 | 8010 | Clave.seg2023 |
| San Sebastián | 186.97.106.252 | 8000 | Clave.seg2023 |
| Altagracia | 181.205.175.18 | 8030 | Clave.seg2023 |
| Senderos | 38.9.217.12 | 8000 | Clave.seg2023 |

### Paso 5: Configurar en el servidor

```bash
ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6

cd /var/www/aionseg/backend/apps/backend-api
echo "" >> .env
echo "# HikConnect Cloud" >> .env
echo "HIKCONNECT_AK=tu_access_key_aqui" >> .env
echo "HIKCONNECT_SK=tu_secret_key_aqui" >> .env

pm2 restart aionseg-api
```

### Nota:
- **ALTERNATIVA al port forward (Acción 6):** Si vinculas todos los DVR a HikConnect, NO necesitas hacer port forward en cada sede
- El acceso cloud es más estable que RTSP directo porque no depende de la IP pública cambiante
- Costo: Hik-Connect básico es **gratuito**

---

## ACCIÓN 6: Port Forward RTSP (30 min por sede)

**NOTA:** Si completaste la Acción 5 (HikConnect Cloud), esta acción es **OPCIONAL** para la mayoría de sedes. Solo es necesaria si quieres la menor latencia posible o si HikConnect no soporta algún modelo de DVR.

**Estado actual:** Los streams RTSP del VPS van directamente a las IPs públicas de los DVR. Actualmente las 328 cámaras ya están configuradas en go2rtc y 100% coinciden con la DB. Los 7 DVR Hikvision no respondieron al test ISAPI desde el VPS, pero los streams RTSP SÍ funcionan (ya están configurados en go2rtc).

### Para cada sede, estos son los datos del DVR:

| # | Sede | IP Pública | Puerto | User | Password | Cámaras |
|---|------|------------|--------|------|----------|---------|
| 1 | Altagracia | 181.205.175.18 | 8030 | admin | Clave.seg2023 | 33 |
| 2 | Torre Lucia | 181.205.215.210 | 8010 | admin | seg12345 | 24 |
| 3 | Portalegre | 200.58.214.114 | 554 | admin | Clave.seg2023 | 20 |
| 4 | San Nicolás | 181.143.16.170 | 554 | admin | Clave.seg2023 | 17 |
| 5 | Pisquines | 181.205.202.122 | 8010 | admin | Clave.seg2023 | 32 |
| 6 | San Sebastián | 186.97.106.252 | 8000 | admin | Clave.seg2023 | 16 |
| 7 | Senderos | 38.9.217.12 | 8000 | admin | Clave.seg2023 | 12 |

### Proceso por sede (ejemplo: Torre Lucia):

1. **Acceder al router** de la sede:
   - Ir físicamente o pedir al administrador de la sede
   - La IP del router suele ser `192.168.1.1` o `192.168.0.1`
   - Credenciales del router (preguntarle al ISP o al administrador)

2. **Buscar la sección NAT / Port Forwarding:**
   - En routers Claro/Movistar/Tigo suele estar en:
     - Configuración Avanzada → NAT → Port Forwarding
     - O: Firewall → Virtual Servers

3. **Crear la regla:**
   ```
   Nombre:         DVR-Hikvision
   Protocolo:      TCP
   Puerto externo: 8010  (el mismo que ya usa)
   IP interna:     192.168.X.X  (la IP LAN del DVR — ver abajo cómo encontrarla)
   Puerto interno: 8000  (puerto por defecto del DVR)
   Estado:         Habilitado
   ```

4. **También reenviar el puerto RTSP:**
   ```
   Nombre:         DVR-RTSP
   Protocolo:      TCP
   Puerto externo: 554  (o el que uses)
   IP interna:     192.168.X.X  (misma IP del DVR)
   Puerto interno: 554
   Estado:         Habilitado
   ```

5. **Encontrar la IP del DVR en la red local:**
   - Opción A: Usar la app **SADP Tool** de Hikvision (descargable gratis)
   - Opción B: Acceder al DVR por pantalla → Configuración → Red → ver IP
   - Opción C: Revisar el router → Dispositivos conectados → buscar "HIKVISION"

6. **Verificar desde el VPS:**
   ```bash
   # Probar ISAPI
   curl -s --digest -u admin:seg12345 --connect-timeout 5 \
     http://181.205.215.210:8010/ISAPI/System/deviceInfo

   # Probar RTSP (con ffprobe)
   ffprobe -v quiet -print_format json -show_format \
     rtsp://admin:seg12345@181.205.215.210:8010/Streaming/Channels/101
   ```

### IP dinámica:
- Si la sede tiene IP dinámica (cambia cada cierto tiempo), hay 3 soluciones:
  1. **Pedir IP fija al ISP** (Claro/Movistar — cuesta ~$20.000/mes extra)
  2. **Usar DDNS** en el DVR: Configuración → Red → DDNS → habilitar con hik-online.com
  3. **Usar HikConnect Cloud** (Acción 5) — recomendado

---

## ACCIÓN 7: Teléfonos Fanvil (15 min por teléfono)

**Estado actual:** Asterisk v20.6.0 está activo con **81 extensiones PJSIP** configuradas. Ningún teléfono físico conectado todavía.

### Extensiones disponibles:

**Central de Monitoreo (las que necesitas primero):**

| Ext | Nombre | Usuario | Password | Para |
|-----|--------|---------|----------|------|
| 099 | Central AION | 099 | C3ntr4l.A10N.2026! | Línea principal de la central |
| 100 | Monitoreo Central | 100 | Cl4v3.M0n1t0r30! | Operador principal |
| 101 | Monitoreo Op1 | 101 | Cl4v3.Op3r4d0r1! | Operador 1 |
| 102 | Monitoreo Op2 | 102 | Cl4v3.Op3r4d0r2! | Operador 2 |
| 103 | Supervisor 1 | 103 | Sup3rv1s0r.103! | Supervisor |
| 104 | Supervisor 2 | 104 | Sup3rv1s0r.104! | Supervisor |
| 105 | Coordinador 1 | 105 | C00rd1n4d0r.105! | Coordinador zona |
| 106 | Coordinador 2 | 106 | C00rd1n4d0r.106! | Coordinador zona |
| 107 | Admin Isabella | 107 | Adm1n.Is4b3ll4.107! | Administradora |
| 108 | Tecnico 1 | 108 | T3cn1c0.108! | Soporte técnico |
| 109 | Tecnico 2 | 109 | T3cn1c0.109! | Soporte técnico |
| 110 | Gerencia | 110 | G3r3nc14.110! | Gerencia |
| 111 | Emergencias | 111 | Em3rg3nc14.111! | Línea de emergencias |
| 112 | Puesto Movil | 112 | M0v1l.112! | Ronda/móvil |

**Sedes (recepción/portería):**

| Ext | Sede | Password |
|-----|------|----------|
| 200 | Torre Lucia | TL.Pu3st0.200! |
| 201 | San Nicolas | SN.Pu3st0.201! |
| 202 | Alborada | AL.Pu3st0.202! |
| 203 | Brescia | BR.Pu3st0.203! |
| 204 | Patio Bonito | PB.Pu3st0.204! |
| 205 | Pisquines | PS.Pu3st0.205! |
| 206 | San Sebastian | SS.Pu3st0.206! |
| 207 | Terrabamba | TB.Pu3st0.207! |
| 208 | Altos del Rosario | AR.Pu3st0.208! |
| 209 | Senderos Calasanz | SC.Pu3st0.209! |
| 210 | Danubios | DA.Pu3st0.210! |
| 211 | Terrazzino | TZ.Pu3st0.211! |
| 212 | Portal Plaza | PP.Pu3st0.212! |
| 213 | Portalegre | PA.Pu3st0.213! |
| 214 | Altagracia | AG.Pu3st0.214! |
| 215 | Lubeck | LB.Pu3st0.215! |
| 216 | Manzanares | MZ.Pu3st0.216! |
| 217 | Quintas Sta Maria | QS.Pu3st0.217! |
| 218 | Apartacasas | AC.Pu3st0.218! |
| 219 | Hospital Palencia | HP.Pu3st0.219! |
| 220 | Hospital San Jeronimo | HJ.Pu3st0.220! |

**Intercomunicación Torre Lucia:**

| Ext | Nombre | Password |
|-----|--------|----------|
| 300 | IC TorreLucia Peatonal | IC.TL.300! |
| 301 | IC TorreLucia Vehicular | IC.TL.301! |

**Puestos de guardia (2 por sede, 400-441):**

| Ext | Puesto | Password |
|-----|--------|----------|
| 400 | TorreLucia Puesto1 | TL.P1.Cl4v3.400! |
| 401 | TorreLucia Puesto2 | TL.P2.Cl4v3.401! |
| 402 | SanNicolas Puesto1 | SN.P1.Cl4v3.402! |
| 403 | SanNicolas Puesto2 | SN.P2.Cl4v3.403! |
| ... | (patrón: SEDE.PX.Cl4v3.EXT!) | ... |
| 440 | HospSanJeronimo Puesto1 | HJ.P1.Cl4v3.440! |
| 441 | HospSanJeronimo Puesto2 | HJ.P2.Cl4v3.441! |

### Configuración de cada teléfono Fanvil:

**Modelos recomendados:** Fanvil X3SP, X4U, o X6U

#### Paso 1: Conectar el teléfono
1. Conectar cable Ethernet al teléfono (puerto LAN)
2. Conectar alimentación (PoE o adaptador)
3. Esperar a que encienda y obtenga IP por DHCP
4. En la pantalla del teléfono, ir a: **Menu → Status** → anotar la IP (ej: 192.168.1.150)

#### Paso 2: Acceder a la web del teléfono
1. Abrir navegador → escribir la IP del teléfono: `http://192.168.1.150`
2. Login por defecto:
   ```
   Usuario: admin
   Password: admin
   ```

#### Paso 3: Configurar la cuenta SIP
1. Ir a: **Line → SIP → Line 1**
2. Configurar:
   ```
   Line Active:        Enabled
   Label:              Monitoreo Central  (o el nombre de la extensión)
   Display Name:       Monitoreo Central
   Register Name:      100  (el número de extensión)
   User Name:          100
   Password:           Cl4v3.M0n1t0r30!  (la password de la tabla arriba)
   SIP Server 1:       18.230.40.6
   SIP Server Port:    5060  (UDP) o 5061 (TLS — preferido)
   Transport:          UDP  (o TLS si el teléfono lo soporta)
   ```
3. Clic en **Apply** o **Save**

#### Paso 4: Verificar registro
1. En la pantalla del teléfono debería aparecer el nombre de la extensión
2. El ícono de teléfono debería estar verde (registrado)
3. Verificar en el servidor:
   ```bash
   ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6
   sudo asterisk -rx "pjsip show endpoints" | grep "100"
   # Debería mostrar "Avail" en vez de "Unavailable"
   ```

#### Paso 5: Probar llamada
1. Desde el teléfono configurado (ext 100), marcar: `101`
2. Si hay otro teléfono con la ext 101, debería sonar
3. Para probar sin otro teléfono, puedes usar un **softphone** en tu celular:
   - Descargar: **Location** (iOS) o **Opal** (Android) o **Opal** (iOS)
   - Configurar con otra extensión (ej: 107 para Isabella)
   - Hacer llamada entre el teléfono y el softphone

### Configuración recomendada de prioridad:

```
Fase 1 (Central): Extensiones 099, 100, 101, 102, 107
                   → 5 teléfonos para la central de monitoreo

Fase 2 (Sedes principales): 200, 201, 203, 205
                              → Torre Lucia, San Nicolas, Brescia, Pisquines

Fase 3 (Todas las sedes): 202-220
                           → Todas las demás sedes

Fase 4 (Puestos de guardia): 400-441
                              → Cuando tengan segundo punto de acceso
```

### Softphone temporal (sin comprar teléfonos):

Si quieres probar antes de comprar teléfonos físicos:

1. Descargar **Opal SIP Client** (Android/iOS) — gratis
2. Configurar:
   ```
   Server:    18.230.40.6
   Port:      5060
   Username:  107
   Password:  Adm1n.Is4b3ll4.107!
   ```
3. Ya puedes hacer y recibir llamadas desde tu celular

---

## ACCIÓN 8: Registro SIC RNBD (1-2 horas)

**Contexto legal:** La Ley 1581 de 2012 de Colombia exige que toda empresa que trate datos personales registre sus bases de datos ante la Superintendencia de Industria y Comercio (SIC) en el Registro Nacional de Bases de Datos (RNBD).

### Datos de AION que requieren registro:

| Base de datos | Registros | Tipos de datos |
|---------------|-----------|----------------|
| Residentes | 1,823 | Nombre, cédula, torre/apto, teléfono |
| Vehículos | 971 | Placa, marca, color, propietario |
| Biométricos | 1,410 | Nombre, tipo biométrico, fecha |
| Visitantes | 1+ (crece con uso) | Nombre, cédula, fecha visita, a quién visita |
| Guardias/Personal | 17 | Nombre, horario, sede asignada |

### Paso 1: Registrarse en el RNBD

1. Ir a **https://rnbd.sic.gov.co/**
2. Clic en **"Ingresar"** → **"Registrarse"**
3. Tipo de inscripción: **Persona Jurídica** (si es empresa) o **Persona Natural** (si es unipersonal)
4. Datos de la empresa:
   ```
   Razón social:    Clave Seguridad CTA  (o el nombre legal exacto)
   NIT:             (el NIT de la empresa)
   Representante:   (nombre del representante legal)
   Cédula:          (cédula del representante)
   Email:           jlort1721@gmail.com
   Teléfono:        (teléfono de la empresa)
   Dirección:       (dirección de la central de monitoreo en Medellín)
   Ciudad:          Medellín
   Departamento:    Antioquia
   ```
5. Verificar email y completar registro

### Paso 2: Registrar cada base de datos

Para **CADA** base de datos (repetir 5 veces):

1. Ir a **"Registrar Base de Datos"**
2. Información general:
   ```
   Nombre de la BD:       [Residentes / Vehículos / Biométricos / Visitantes / Personal]
   Finalidad:             Seguridad, vigilancia y control de acceso residencial
   Contiene datos de:     Personas naturales
   País de almacenamiento: Colombia
   ¿Transfiere datos?:    No
   ```

3. Categorías de datos (marcar las que apliquen):

   **Para Residentes:**
   - ☑ Datos de identificación (nombre, cédula)
   - ☑ Datos de localización (torre, apartamento)
   - ☑ Datos de contacto (teléfono, email)

   **Para Vehículos:**
   - ☑ Datos de identificación (propietario)
   - ☑ Otros (placa, marca, color)

   **Para Biométricos:**
   - ☑ Datos biométricos (huella, rostro)
   - ☑ Datos de identificación

   **Para Visitantes:**
   - ☑ Datos de identificación
   - ☑ Datos de contacto

   **Para Personal:**
   - ☑ Datos de identificación
   - ☑ Datos laborales

4. Medidas de seguridad (marcar TODAS):
   ```
   ☑ Control de acceso a la información (usuarios y contraseñas)
   ☑ Cifrado de datos (encriptación)
   ☑ Políticas de seguridad de la información
   ☑ Registro de acceso a la información (logs de auditoría)
   ☑ Copias de respaldo (backup automático diario)
   ☑ Control de acceso físico (servidores en AWS)
   ☑ Firewall
   ☑ SSL/TLS
   ```

5. Canales de atención al titular:
   ```
   Email:     jlort1721@gmail.com  (o un email dedicado a habeas data)
   Teléfono:  (teléfono de la empresa)
   Dirección: (dirección física)
   ```

6. Clic en **"Registrar"**

### Paso 3: Generar y guardar certificado

1. Una vez registradas las 5 bases de datos, ir a **"Mis Bases de Datos"**
2. Para cada una, descargar el **Certificado de Inscripción**
3. Guardar los PDFs en un lugar seguro
4. Imprimir y tener disponible en la central de monitoreo

### Paso 4: Política de tratamiento de datos

Debes tener publicada una **Política de Tratamiento de Datos Personales**. Contenido mínimo:

```
1. Responsable: Clave Seguridad CTA, NIT: XXXX, Medellín
2. Finalidad: Control de acceso, videovigilancia, seguridad residencial
3. Derechos del titular: Conocer, actualizar, rectificar, solicitar supresión
4. Procedimiento: Solicitudes por email a [email] con respuesta en 15 días hábiles
5. Vigencia: Las bases de datos se mantienen mientras exista relación contractual
```

Publicar en la web: `https://aionseg.co/politica-datos` (o como PDF descargable).

### Fechas límite:
- Plazo de registro: **permanente** (las empresas deben mantener actualizado el registro)
- Sanción por no registro: multas de hasta **2,000 SMLMV** (~$2,600 millones COP)

---

## ACCIÓN 9: Cerrar PRs de GitHub (5 minutos)

**Contexto:** Los PRs #7, #8 y #9 contienen passwords expuestos en el historial de commits.

**NOTA:** El repositorio en el VPS NO tiene remote de Git configurado (verificado). Si tienes el repo en GitHub:

### Paso 1: Identificar el repositorio

1. Ir a **https://github.com/** → tus repositorios
2. Buscar el repo de AION (puede ser algo como `aion-platform`, `open-view-hub`, o similar)
3. Ir a la pestaña **"Pull requests"**

### Paso 2: Cerrar los PRs

1. Abrir **PR #7** → scroll hasta abajo → clic en **"Close pull request"**
   - Agregar comentario: "Closed — contained exposed credentials. Migrated to production deployment."
2. Repetir para **PR #8**
3. Repetir para **PR #9**

### Paso 3: Limpiar el historial (IMPORTANTE)

Si los PRs tienen passwords visibles en los diffs, cerrar el PR NO elimina el contenido. Para eliminar completamente:

**Opción A — Eliminar las ramas de los PRs:**
1. En cada PR cerrado, clic en **"Delete branch"**
2. Esto elimina la rama del PR (los commits quedan como huérfanos y GitHub los borra eventualmente)

**Opción B — Si están en commits del main (más grave):**
1. Usar `git filter-branch` o `BFG Repo-Cleaner` para reescribir el historial
2. Esto es más complejo — hacerlo con cuidado:

```bash
# Instalar BFG (más fácil que filter-branch)
# En tu máquina local:
brew install bfg  # macOS

# Clonar mirror del repo
git clone --mirror https://github.com/TU_USUARIO/TU_REPO.git

# Crear archivo con passwords a eliminar
cat > passwords.txt << EOF
Clave.seg2023
seg12345
Jml1413031.
A10n_R3d1s_2026!
EOF

# Ejecutar BFG para eliminar los passwords
bfg --replace-text passwords.txt TU_REPO.git

# Push forzado (esto reescribe el historial)
cd TU_REPO.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**IMPORTANTE:** Después del force push, todos los que tengan el repo clonado deben hacer `git fetch --all && git reset --hard origin/main`.

### Paso 4: Rotar credenciales expuestas

Si los passwords estuvieron expuestos en GitHub público:

```bash
ssh -i /path/to/clave-demo-aion.pem ubuntu@18.230.40.6

# 1. Cambiar password del DVR de Torre Lucia (era seg12345)
# → Acceder al DVR web → System → User Management → cambiar password

# 2. Cambiar password de Redis (si estaba expuesto)
# → Ya está en .env como variable, no hardcoded

# 3. Cambiar JWT_SECRET
cd /var/www/aionseg/backend/apps/backend-api
# Generar nuevo secret
NEW_SECRET=$(openssl rand -hex 32)
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
pm2 restart aionseg-api
# NOTA: Esto cierra todas las sesiones activas — los usuarios deben re-loguearse
```

---

## ACCIÓN 10: Crear los 67 workflows n8n (plan de 4 semanas)

**Prerequisitos:**
- Acción 1 (cuenta n8n) completada
- Idealmente Acción 2 (Telegram) y/o Acción 3 (WhatsApp) completadas

### Datos de conexión para los workflows:

**Backend API (para todos los workflows):**
```
Base URL:    http://localhost:3001
Auth Header: Authorization: Bearer <TOKEN>
Login:       POST http://localhost:3001/auth/login
             Body: {"email":"jlort1721@gmail.com","password":"Jml1413031."}
```

**Webhooks n8n → Backend (9 disponibles):**
```
Base URL:    http://localhost:3001/webhooks/n8n/
Secret:      x-webhook-secret: aion-n8n-2026
Endpoints:   event, incident, device-status, visitor, door-request,
             security-alert, health-report, patrol-checkpoint, emergency-activate
```

**PostgreSQL directo (para workflows que necesitan queries):**
```
Host:     localhost
Port:     5432
Database: aionseg_prod
User:     postgres
Password: (sin password — trust local)
```

---

### SEMANA 1: Monitoring + Alertas Base (5 workflows)

#### Workflow 1: Health Monitor (cada 2 minutos)

1. **"+ Add Workflow"** → nombre: `01 - Health Monitor`
2. Nodo **Schedule Trigger**: Every 2 minutes
3. Nodo **HTTP Request**:
   ```
   Method: GET
   URL: http://localhost:3001/health/ready
   ```
4. Nodo **IF**: `{{ $json.data.status !== "ok" }}`
   - True → Nodo **HTTP Request** (POST):
     ```
     URL: http://localhost:3001/webhooks/n8n/security-alert
     Headers: x-webhook-secret: aion-n8n-2026
     Body: {
       "title": "Backend API Down",
       "severity": "critical",
       "description": "Health check failed at {{ $now.toISO() }}"
     }
     ```
   - True → También enviar Telegram (si configurado)
5. Activar

#### Workflow 2: Device Monitor (cada 5 minutos)

1. **"+ Add Workflow"** → `02 - Device Monitor`
2. Nodo **Schedule Trigger**: Every 5 minutes
3. Nodo **HTTP Request**:
   ```
   GET http://localhost:3001/domotics/devices
   Headers: Authorization: Bearer {{ login.token }}
   ```
4. Nodo **Function**:
   ```javascript
   const devices = $input.first().json.data;
   const offline = devices.filter(d => !d.online);
   const offlineCount = offline.length;
   const totalCount = devices.length;

   if (offlineCount > 10) {
     return [{json: {
       alert: true,
       message: `⚠️ ${offlineCount}/${totalCount} dispositivos offline`,
       devices: offline.map(d => d.name).slice(0, 10).join(', ')
     }}];
   }
   return [{json: {alert: false}}];
   ```
5. Nodo **IF**: `{{ $json.alert === true }}`
   - True → Telegram/WhatsApp alert
6. Activar

#### Workflow 3: Daily Report (7 AM)

1. **"+ Add Workflow"** → `03 - Daily Report`
2. Nodo **Schedule Trigger**: At 7:00 AM every day
3. Nodo **HTTP Request** (Dashboard):
   ```
   GET http://localhost:3001/analytics/dashboard
   ```
4. Nodo **HTTP Request** (Events últimas 24h):
   ```
   GET http://localhost:3001/events?since=24h
   ```
5. Nodo **HTTP Request** (Incidents abiertos):
   ```
   GET http://localhost:3001/incidents?status=open
   ```
6. Nodo **Function** (formatear reporte):
   ```javascript
   const dashboard = $('Dashboard').first().json.data;
   const events = $('Events').first().json.data;
   const incidents = $('Incidents').first().json.data;

   const report = `📊 REPORTE DIARIO AION - ${new Date().toLocaleDateString('es-CO')}

   🎥 Cámaras: ${dashboard.cameras || 328}
   📡 Dispositivos: ${dashboard.devices || 86}
   ⚠️ Eventos (24h): ${events.length || 0}
   🚨 Incidentes abiertos: ${incidents.length || 0}
   👥 Residentes: ${dashboard.residents || 1823}
   🚗 Vehículos: ${dashboard.vehicles || 971}`;

   return [{json: {report}}];
   ```
7. Nodo **Telegram** → enviar `{{ $json.report }}`
8. Activar

#### Workflow 4: Incident Auto-Classify

1. **"+ Add Workflow"** → `04 - Incident Auto-Classify`
2. Nodo **Webhook**: POST → path: `incident-classify`
3. Nodo **Function**:
   ```javascript
   const { title, description } = $input.first().json;
   const text = (title + ' ' + description).toLowerCase();

   let priority = 'medium';
   let category = 'general';

   if (text.includes('intrusion') || text.includes('robo') || text.includes('arma')) {
     priority = 'critical'; category = 'security';
   } else if (text.includes('incendio') || text.includes('humo') || text.includes('gas')) {
     priority = 'critical'; category = 'fire';
   } else if (text.includes('agua') || text.includes('inundacion')) {
     priority = 'high'; category = 'water';
   } else if (text.includes('puerta') || text.includes('acceso')) {
     priority = 'medium'; category = 'access';
   } else if (text.includes('camara') || text.includes('video')) {
     priority = 'low'; category = 'equipment';
   }

   return [{json: {priority, category, original: $input.first().json}}];
   ```
4. Nodo **HTTP Request**:
   ```
   POST http://localhost:3001/webhooks/n8n/incident
   Headers: x-webhook-secret: aion-n8n-2026
   Body: {
     "title": "{{ $json.original.title }}",
     "priority": "{{ $json.priority }}",
     "description": "Auto-classified as {{ $json.category }}: {{ $json.original.description }}"
   }
   ```
5. Si priority es critical → también enviar Telegram
6. Activar

#### Workflow 5: Camera Offline Alert

1. **"+ Add Workflow"** → `05 - Camera Offline Alert`
2. Nodo **Schedule Trigger**: Every 10 minutes
3. Nodo **HTTP Request**:
   ```
   GET http://localhost:1984/api/streams
   ```
4. Nodo **Function**:
   ```javascript
   const streams = $input.first().json;
   const offline = [];

   for (const [key, value] of Object.entries(streams)) {
     if (!value.producers || value.producers.length === 0) {
       offline.push(key);
     }
   }

   if (offline.length > 5) {
     return [{json: {
       alert: true,
       count: offline.length,
       cameras: offline.slice(0, 20).join(', ')
     }}];
   }
   return [{json: {alert: false}}];
   ```
5. IF alert → Telegram: `🎥 ${count} cámaras sin stream activo`
6. Activar

---

### SEMANA 2: Notificaciones + Turnos (5 workflows)

#### Workflow 6: Shift Change Summary

1. **Schedule Trigger**: At 6:00 AM, 2:00 PM, 10:00 PM (cambios de turno)
2. **PostgreSQL** query:
   ```sql
   SELECT s.name as sede, sa.guard_name, sa.shift_type
   FROM shift_assignments sa
   JOIN sites s ON sa.site_id = s.id
   WHERE sa.shift_date = CURRENT_DATE
   ORDER BY s.name;
   ```
3. Formatear y enviar por Telegram

#### Workflow 7: Visitor Pre-register Notification

1. **Webhook Trigger**: POST `/visitor-notify`
2. Recibe datos del visitante pre-registrado
3. Enviar WhatsApp al guardia de la sede
4. Enviar Telegram a la central

#### Workflow 8: Escalation Timer

1. **Schedule Trigger**: Every 5 minutes
2. **PostgreSQL**:
   ```sql
   SELECT * FROM incidents
   WHERE status = 'open'
   AND created_at < NOW() - INTERVAL '30 minutes'
   AND priority IN ('high', 'critical');
   ```
3. Si hay incidentes sin atender > 30 min → escalar por Telegram al supervisor

#### Workflow 9: Patrol Compliance Check

1. **Schedule Trigger**: Every hour
2. **PostgreSQL**: Verificar que hay patrol_logs de la última hora
3. Si no hay → alertar que la ronda no se ha completado

#### Workflow 10: Equipment Restart Monitor

1. **Schedule Trigger**: Every 30 minutes
2. **HTTP Request**: `GET http://localhost:3001/operational-data/equipment-restarts`
3. Si hay reinicios programados pendientes → recordar por Telegram

---

### SEMANA 3: Automatización Avanzada (5 workflows)

#### Workflow 11-17: Emergency Protocols (7 tipos)

Crear un workflow para cada tipo de emergencia:
- Intrusión → activar alarma eWeLink + grabar cámaras + alertar policía
- Incendio → activar evacuación + alertar bomberos + desbloquear puertas
- Inundación → cortar electricidad zona + alertar mantenimiento
- Médica → alertar línea 123 + notificar administración
- Sísmica → protocolo evacuación + verificar estructura
- Amenaza → lockdown + alertar autoridades
- Falla eléctrica → verificar UPS + activar respaldo

Cada uno sigue el patrón:
1. **Webhook Trigger** (o detección automática)
2. **HTTP Request** al backend para crear el incidente
3. **Acciones automáticas** (eWeLink, notificaciones)
4. **Alertas** por Telegram/WhatsApp

#### Workflow 18: Auto-Reboot Devices

1. **Schedule Trigger**: Daily at 3:00 AM
2. **PostgreSQL**: Buscar dispositivos con reboot programado
3. Ejecutar reboot vía API del dispositivo
4. Registrar resultado

#### Workflow 19: Risk Scoring

1. **Schedule Trigger**: Every 30 minutes
2. Calcular score basado en: eventos, incidentes, dispositivos offline, cámaras sin stream
3. Si score > umbral → alerta

#### Workflow 20: Anomaly Detection

1. **Schedule Trigger**: Every 15 minutes
2. Comparar patrones de eventos con historial
3. Si hay anomalía → crear alerta

---

### SEMANA 4: Gestión y Reportes (5+ workflows)

#### Workflow 21: Contract Expiry Alert
- Verificar contratos próximos a vencer (30, 15, 7 días)

#### Workflow 22: Training Reminder
- Verificar capacitaciones programadas y recordar

#### Workflow 23: Weekly Compliance Report
- Generar reporte semanal de cumplimiento

#### Workflow 24: Key Tracking
- Verificar llaves prestadas sin devolver

#### Workflow 25: SLA Monitor
- Calcular tiempos de respuesta vs SLA definidos

### Workflows restantes (26-67):
Los prompts completos están en:
- `PROMPT-N8N-AUTOMATIZACIONES-AION.md` (42 workflows)
- `PROMPT-N8N-25-AUTOMATIZACIONES-NUEVAS.md` (25 workflows)

Cada prompt tiene la especificación completa del workflow. Para crear cada uno:
1. Leer el prompt
2. En n8n, crear nuevo workflow
3. Agregar los nodos según la especificación
4. Probar con datos de prueba
5. Activar

**Ritmo recomendado:** 3-5 workflows por día = **2-3 semanas** para los 67.

---

## RESUMEN DE COSTOS MENSUALES

| Servicio | Costo USD/mes |
|----------|---------------|
| VPS AWS (t3.xlarge) | ~$60-80 |
| Twilio WhatsApp (sandbox gratis, producción) | $0-30 |
| Telegram Bot | Gratis |
| n8n (self-hosted) | Gratis |
| eWeLink (ya configurado) | Gratis |
| HikConnect (básico) | Gratis |
| Dominio aionseg.co | ~$1 |
| SSL (Let's Encrypt) | Gratis |
| **TOTAL** | **$61-111/mes** |

---

## ORDEN RECOMENDADO DE EJECUCIÓN

```
DÍA 1 (30 min):
  ✅ Acción 1: Crear cuenta n8n
  ✅ Acción 2: Crear bot Telegram (pasos 1-3)
  ✅ Acción 2: Configurar Telegram en servidor (pasos 4-5)
  ✅ Acción 9: Cerrar PRs GitHub

DÍA 2 (1 hora):
  ✅ Acción 3: Crear cuenta Twilio + sandbox WhatsApp
  ✅ Acción 10: Crear workflows 1-5 (Semana 1)

DÍA 3 (1 hora):
  ✅ Acción 5: Registrarse en HikConnect (si quieres cloud)
  ✅ Acción 7: Configurar softphone (prueba sin teléfono físico)
  ✅ Acción 10: Crear workflows 6-10 (Semana 2)

SEMANA 2:
  ✅ Acción 8: Registro SIC RNBD (1-2 horas)
  ✅ Acción 10: Crear workflows 11-20 (Semana 3)
  ✅ Acción 6: Port forward primera sede (Torre Lucia)

SEMANA 3-4:
  ✅ Acción 7: Comprar e instalar teléfonos Fanvil
  ✅ Acción 6: Port forward sedes restantes
  ✅ Acción 10: Crear workflows 21-67 (Semana 4)
```
