# GUÍA DE CONFIGURACIÓN — Asterisk PBX / Telefonía IP
## Para configurar TODOS los puestos con citofonía AION

**Servidor VPS:** 18.230.40.6
**Plataforma:** https://aionseg.co
**Sistema PBX:** Asterisk 20.6 con PJSIP

---

## DATOS DEL SERVIDOR (para configurar cualquier teléfono)

| Dato | Valor |
|------|-------|
| Servidor SIP | 18.230.40.6 |
| Puerto SIP (UDP) | 5060 |
| Puerto SIP (TLS) | 5061 |
| Puerto WebSocket (WSS) | 8089 |
| Protocolo | PJSIP |
| Codecs | opus, ulaw, alaw, g722 |
| Transporte recomendado | TLS (teléfonos) / WSS (navegador) |

---

## EXTENSIONES ASIGNADAS

### Central de Monitoreo (099-112)

| Extensión | Asignación | Tipo | Contraseña |
|-----------|-----------|------|------------|
| **099** | Central AION (navegador web) | WebRTC | C3ntr4l.A10N.2026! |
| **100** | Operador 1 — PC principal | Softphone/WebRTC | Op3r4d0r.100! |
| **101** | Operador 2 — PC secundario | Softphone/WebRTC | Op3r4d0r.101! |
| **102** | Operador 3 | Softphone/WebRTC | Op3r4d0r.102! |
| **103** | Supervisor | Softphone | Op3r4d0r.103! |
| **104-112** | Reserva operadores | Softphone | Op3r4d0r.{ext}! |

### Puestos de Seguridad (200-223)

| Extensión | Sede | Tipo |
|-----------|------|------|
| **200** | San Nicolás | Teléfono IP / Softphone |
| **201** | Portalegre | Teléfono IP / Softphone |
| **202** | La Palencia | Teléfono IP / Softphone |
| **203** | Brescia | Teléfono IP / Softphone |
| **204** | Hospital San Jerónimo | Teléfono IP / Softphone |
| **205** | Danubios | Teléfono IP / Softphone |
| **206** | Terrabamba | Teléfono IP / Softphone |
| **207** | Santana | Teléfono IP / Softphone |
| **208** | Quintas de Santa María | Teléfono IP / Softphone |
| **209** | Patio Bonito | Teléfono IP / Softphone |
| **210** | Terrazzino | Teléfono IP / Softphone |
| **211** | Alborada | Teléfono IP / Softphone |
| **212** | San Sebastián | Teléfono IP / Softphone |
| **213** | Altagracia | Teléfono IP / Softphone |
| **214** | Pisquines | Teléfono IP / Softphone |
| **215** | Torre Lucia | Teléfono IP / Softphone |
| **216** | Senderos | Teléfono IP / Softphone |
| **217** | Altos del Rosario | Teléfono IP / Softphone |
| **218-223** | Reserva nuevos puestos | — |

### Citófonos/Intercomunicadores (300-322)

| Extensión | Sede | Equipo |
|-----------|------|--------|
| **300-322** | Corresponden a cada sede | Fanvil / Grandstream |

---

## CONFIGURACIÓN POR TIPO DE DISPOSITIVO

### A. TELÉFONO WEB (navegador — extensión 099)

Ya está integrado en AION. Para usarlo:

```
1. Abrir https://aionseg.co
2. Login con tu usuario
3. Ir a: Panel Telefónico (menú lateral)
4. El teléfono web se conecta automáticamente a la extensión 099
5. Usa el teclado en pantalla para marcar
6. Para llamar a un puesto: marca 200-223
7. Para llamar a todos los operadores: marca 199
```

**Requisitos del navegador:**
- Chrome 80+ o Edge 80+ (recomendado)
- Safari 14.1+ (Mac/iPhone)
- Firefox 78+
- Micrófono habilitado (el navegador pedirá permiso)
- HTTPS obligatorio (aionseg.co ya tiene SSL)

---

### B. SOFTPHONE EN PC (Microsip, Oreja, Linphone)

**Microsip (Windows — GRATUITO, recomendado):**

```
1. Descargar: https://www.microsip.org/downloads
2. Instalar y abrir
3. Configuración (Settings) → Account:
   - Account Name: AION Puesto {nombre}
   - SIP Server: 18.230.40.6
   - SIP Proxy: 18.230.40.6
   - Username: {extensión} (ej: 200)
   - Domain: 18.230.40.6
   - Password: {contraseña de la extensión}
   - Transport: TLS (recomendado) o UDP
   - Port: 5061 (TLS) o 5060 (UDP)
4. Guardar
5. Estado debe cambiar a "Online" ✅
```

**Linphone (Windows/Mac/Linux/Android/iOS — GRATUITO):**

```
1. Descargar: https://www.linphone.org/technical-corner/linphone
2. Instalar y abrir
3. Usar SIP account → I already have a SIP account
4. Configurar:
   - Username: {extensión}
   - Password: {contraseña}
   - Domain: 18.230.40.6
   - Transport: TLS
   - Display name: Puesto {nombre sede}
5. Advanced:
   - Proxy: sip:18.230.40.6:5061;transport=tls
   - Register: ✅
   - Outbound proxy: ✅
6. Guardar
```

**Oreja (Mac — GRATUITO):**

```
1. Descargar desde App Store: "Oreja"
2. Abrir → Preferences → Accounts → +
3. Account Type: SIP
4. Display Name: Puesto {nombre}
5. User Name: {extensión}
6. Password: {contraseña}
7. Server: 18.230.40.6
8. Port: 5061
9. Transport: TLS
10. Guardar
```

---

### C. SOFTPHONE EN CELULAR (para vigilantes)

**Oreja para iOS / Oreja para Android:**

```
1. Descargar "Oreja" desde App Store o Play Store
2. Configurar cuenta SIP:
   - Server: 18.230.40.6
   - Port: 5061
   - Username: {extensión del puesto}
   - Password: {contraseña}
   - Transport: TLS
3. Guardar → debe mostrar "Registered" ✅
```

**Linphone para iOS/Android:**

```
1. Descargar "Linphone" desde App Store o Play Store  
2. Use SIP account
3. Username: {extensión}
4. Password: {contraseña}
5. Domain: 18.230.40.6
6. Transport: TLS
7. Guardar
```

**Groundwire (iOS/Android — PAGO $9.99, mejor calidad):**

```
1. Descargar desde App Store/Play Store
2. Settings → Accounts → +
3. Account: SIP
4. Display Name: Puesto {nombre}
5. Username: {extensión}
6. Password: {contraseña}
7. Domain: 18.230.40.6
8. Proxy: 18.230.40.6:5061
9. Transport: TLS
10. Codec: Opus (prioridad 1), G.722 (prioridad 2), ulaw (prioridad 3)
11. Guardar
```

---

### D. TELÉFONO IP FÍSICO (Fanvil, Grandstream, Yealink)

**Fanvil X3S/X3SP/X4/X5:**

```
1. Abrir navegador → http://IP_DEL_TELEFONO (default: 192.168.1.xxx)
   Default login: admin / admin

2. Line → SIP → Line 1:
   - Enable Line: ✅
   - Label: AION {Sede}
   - Display Name: Puesto {nombre}
   - Register Name: {extensión}
   - User Name: {extensión}
   - Password: {contraseña}
   - SIP Server 1: 18.230.40.6
   - SIP Server Port: 5060
   - Transport: UDP (o TLS si soporta)
   - Register Status: debe decir "Registered" ✅

3. Audio → Codec:
   - Enabled: G.711 u-law, G.711 a-law, G.722
   - Disabled: G.729 (a menos que tenga licencia)

4. Guardar → Reboot
```

**Grandstream GXP1610/1620/1625/2130/2135:**

```
1. Abrir navegador → http://IP_DEL_TELEFONO
   Default login: admin / admin

2. Accounts → Account 1 → General Settings:
   - Account Active: Yes
   - Account Name: AION {Sede}
   - SIP Server: 18.230.40.6
   - SIP User ID: {extensión}
   - Authenticate ID: {extensión}
   - Authenticate Password: {contraseña}
   - Name: Puesto {nombre}
   - SIP Transport: UDP (o TLS)

3. Accounts → Account 1 → Codec Settings:
   - Preferred Vocoder: PCMU, PCMA, G722
   
4. Guardar → Reboot
```

**Yealink T2x/T3x/T4x Series:**

```
1. Abrir navegador → http://IP_DEL_TELEFONO
   Default login: admin / admin

2. Account → Register:
   - Line Active: Enabled
   - Label: AION {Sede}
   - Display Name: Puesto {nombre}
   - Register Name: {extensión}
   - User Name: {extensión}
   - Password: {contraseña}
   - SIP Server 1: 18.230.40.6
   - Port: 5060
   - Transport: UDP
   - Server Expires: 3600

3. Codec:
   - Enable: G711U, G711A, G722
   
4. Confirm → Reboot
```

---

### E. INTERCOMUNICADOR / VIDEOPORTERO IP

**Fanvil i10/i12/i16/i20S/i30:**

```
1. Navegador → http://IP_DEL_INTERCOM
   Default: admin / admin

2. SIP → SIP Account:
   - Enable: ✅
   - Display Name: Intercom {Sede}
   - User Name: {extensión 300-322}
   - Register Name: {extensión}
   - Password: {contraseña}
   - SIP Server: 18.230.40.6
   - Port: 5060
   - Transport: UDP

3. Intercom → Door Settings:
   - Door 1: Enable
   - Lock Type: según instalación (relay NC/NO)
   - Open Duration: 5 segundos
   
4. Intercom → Speed Dial:
   - Key 1: 099 (llamar a central)
   - Key 2: 199 (llamar a todos los operadores)

5. Guardar → Reboot
```

**Grandstream GDS3710/GDS3712:**

```
1. Navegador → http://IP_DEL_INTERCOM
   Default: admin / admin (o admin / último 6 dígitos del MAC)

2. Account → Account 1:
   - Account Active: Yes
   - SIP Server: 18.230.40.6
   - SIP User ID: {extensión 300-322}
   - Authenticate Password: {contraseña}

3. Door System → Door Settings:
   - Input Port 1: Door Sensor
   - Output Relay: Door Strike
   - Open Duration: 5 sec

4. Door System → Remote PIN:
   - Enable: Yes
   - Open Door PIN: *123# (o el que elijas)
   
5. Guardar → Reboot
```

---

## MARCACIÓN RÁPIDA

| Marcar | Acción |
|--------|--------|
| 099 | Llamar a Central AION |
| 100-112 | Llamar a operador específico |
| 199 | Llamar a TODOS los operadores (ring group) |
| 200-223 | Llamar a puesto de seguridad |
| 300-322 | Llamar a intercomunicador |
| 9 + número celular | Llamar a PSTN (requiere Twilio) |
| 9123 | Policía |
| 9112 | Emergencias |

---

## VERIFICACIÓN POR PUESTO

Después de configurar cada teléfono:

```
1. Verificar que diga "Registered" o "Online" ✅
2. Desde el puesto: marcar 099 → debe sonar en la central
3. Desde la central: marcar {extensión del puesto} → debe sonar en el puesto
4. Verificar audio bidireccional (hablar y escuchar)
5. Si es intercom: probar apertura de puerta con *123#
```

Si un teléfono no registra:

```
1. Verificar que el internet del puesto funciona
2. Hacer ping a 18.230.40.6 desde el puesto
3. Verificar usuario y contraseña (escribirlos de nuevo)
4. Probar con UDP (5060) si TLS (5061) no funciona
5. Verificar que el router no bloquea SIP (algunos ISP lo bloquean)
   → Solución: usar TLS en puerto 5061, o WSS en 8089
```

---

## CONTRASEÑAS POR EXTENSIÓN

**Central y Operadores:**

| Ext | Contraseña |
|-----|-----------|
| 099 | C3ntr4l.A10N.2026! |
| 100 | Op3r4d0r.100! |
| 101 | Op3r4d0r.101! |
| 102 | Op3r4d0r.102! |
| 103 | Op3r4d0r.103! |
| 104-112 | Op3r4d0r.{ext}! |

**Puestos (200-223):**

Para obtener la contraseña de cada puesto, consultar en el VPS:
```
sudo grep -A3 "^\[{extensión}-auth\]" /etc/asterisk/pjsip.conf
```

Formato general: Pu3st0.{ext}.S3g!

**Intercomunicadores (300-322):**

Formato general: Int3rc0m.{ext}!

---

## NOTAS IMPORTANTES

1. **SIP ALG:** Algunos routers tienen "SIP ALG" activado que interfiere con la telefonía. Si hay problemas de audio unidireccional:
   - Desactivar SIP ALG en el router
   - O usar TLS (puerto 5061) en vez de UDP (5060)

2. **NAT:** Asterisk ya tiene configurado `external_media_address` y `external_signaling_address` con la IP pública 18.230.40.6. Los teléfonos detrás de NAT funcionan automáticamente.

3. **Codecs:** Priorizar opus para WebRTC, ulaw/alaw para teléfonos IP, g722 para mejor calidad en teléfonos que lo soporten.

4. **Twilio:** Las llamadas PSTN (a celulares/fijos) requieren una cuenta Twilio configurada. Contactar para activación.

---

*Guía generada para Clave Seguridad CTA — AION Platform — Abril 2026*
