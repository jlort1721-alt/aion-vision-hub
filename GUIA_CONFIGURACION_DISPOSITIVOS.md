# GUÍA DE CONFIGURACIÓN — Dispositivos Hikvision y Dahua
## Para vincular TODOS los equipos a la plataforma AION (aionseg.co)

**Servidor VPS:** 18.230.40.6
**Plataforma:** https://aionseg.co
**Fecha:** Abril 2026

---

## ANTES DE EMPEZAR — Checklist

- [ ] Tener acceso a iVMS-4200 (para Hikvision)
- [ ] Tener acceso a SmartPSS o DMSS (para Dahua)
- [ ] Tener las credenciales: admin / Clave.seg2023
- [ ] Verificar que el internet de cada sede está funcionando
- [ ] Tener este documento impreso o en tablet

---

# PARTE 1: HIKVISION

## Qué se configura en cada DVR/NVR Hikvision

| Cambio | Por qué | Afecta grabación |
|--------|---------|-----------------|
| Substream → H.264 | Elimina transcodificación, video fluido | NO — solo afecta vista remota |
| Platform Access (ISUP) | DVR se conecta al VPS sin IP pública | NO — función adicional |

---

### 1A. SEDES CON IP PÚBLICA Y PORT FORWARDING (ya funcionan)

Estas sedes ya tienen video en AION. Solo necesitan el cambio de H.264:

| Sede | IP Pública | Puerto | Acceso web |
|------|-----------|--------|------------|
| San Nicolás (SN) | 181.143.16.170 | 554 | http://181.143.16.170 |
| Portalegre (PE) | 200.58.214.114 | 554 | http://200.58.214.114 |
| La Palencia (LP) | 181.205.249.130 | 554 | http://181.205.249.130 |

**Configuración via navegador web:**

```
1. Abre en Chrome/Edge: http://IP_PUBLICA (puerto 80 o el que tenga)
   Si pide plugin: usa Internet Explorer o instala el plugin Hikvision

2. Login:
   Usuario: admin
   Contraseña: Clave.seg2023

3. Ir a: Configuración → Video/Audio → Video
   (inglés: Configuration → Video/Audio → Video)

4. Seleccionar: Sub-Stream (pestaña superior)

5. Para CADA canal (ch1, ch2, ch3... hasta el último):
   - Video Encoding (Codificación): cambiar de H.265+ o H.265 → H.264
   - Resolution (Resolución): 704×576 (D1) o 1280×720 (720p)
   - Frame Rate (Cuadros por segundo): 10 fps
   - Bitrate Type (Tipo de bitrate): Variable (VBR)
   - Max Bitrate (Bitrate máximo): 768 Kbps
   - Hacer clic en GUARDAR (Save)
   
6. Pasar al siguiente canal y repetir paso 5

7. IMPORTANTE: NO tocar la pestaña "Main Stream" — esa es la grabación
```

**Configuración via iVMS-4200:**

```
1. Abrir iVMS-4200 → Gestión de Dispositivos (Device Management)
2. Click derecho en el DVR → Configuración Remota (Remote Configuration)
3. Video/Audio → Video
4. Seleccionar canal en el dropdown
5. Pestaña: Sub-Stream
6. Video Encoding → H.264
7. Resolution → D1 o 720P
8. Frame Rate → 10
9. Max Bitrate → 768
10. Guardar → Siguiente canal → Repetir
```

---

### 1B. SEDES CON PUERTO SDK (necesitan ISUP + H.264)

Estas sedes solo tienen acceso por puerto SDK (8000/8010/8030). El video actual es por snapshots. Con ISUP se conectan directo al VPS.

| Sede | IP Pública | Puerto SDK | Canales |
|------|-----------|-----------|---------|
| San Sebastián (SS) | 186.97.106.252 | 8000 | 16 |
| Altagracia DVR1 (AG) | 181.205.175.18 | 8030 | 20 |
| Altagracia DVR2 (AG) | 181.205.175.18 | 8010 | 16 |
| Pisquines DVR (PQ) | 181.205.202.122 | 8010 | 16 |
| Pisquines NVR (PQ) | 181.205.202.122 | 8020 | 16 |
| Torre Lucia DVR (TL) | 181.205.215.210 | 8010 | 16 |
| Torre Lucia NVR (TL) | 181.205.215.210 | 8020 | 8 |
| Senderos DVR (SE) | 38.9.217.12 | 8030 | 8 |
| Altos Rosario (AR) | 190.159.37.188 | 8010 | 16 |
| Brasil LPR1 (BR) | Puerto SDK | — | 1 |
| Brasil LPR2 (BR) | Puerto SDK | — | 1 |

**Configuración via iVMS-4200 (OBLIGATORIO para estos):**

**Paso 1: Cambiar Substream a H.264**
```
1. Abrir iVMS-4200
2. Gestión de Dispositivos → click derecho en el DVR/NVR
3. Configuración Remota → Video/Audio → Video
4. Seleccionar canal
5. Sub-Stream:
   - Video Encoding: H.264
   - Resolution: D1 (704×576)
   - Frame Rate: 10
   - Max Bitrate: 768
6. Guardar → Repetir para cada canal
```

**Paso 2: Activar Platform Access (ISUP/EHome)**
```
1. En iVMS-4200 → Configuración Remota del DVR
2. Red (Network) → Configuración Avanzada (Advanced Settings)
   → Acceso a Plataforma (Platform Access)
   
   Si no aparece "Platform Access", buscar en:
   → Red → EHome / ISUP
   
3. Configurar:
   - Habilitar (Enable): ✅ Activar
   - Tipo de protocolo: ISUP 5.0 (o EHome V5.0)
   - Dirección del servidor: 18.230.40.6
   - Puerto del servidor: 7660
   - ID del dispositivo: (dejar el que genera automáticamente, o poner el serial)
   - Clave de cifrado: Clave.seg2023 (o dejar vacío si no lo pide)
   
4. Guardar

5. El DVR se reiniciará la conexión de plataforma automáticamente
   En 1-2 minutos debe aparecer "Conectado" o "Online" en el estado
```

**Verificación después de configurar:**
```
Esperar 2 minutos después de guardar, luego verificar:
- En iVMS-4200: el estado de Platform Access debe decir "Online" o "Conectado"
- En el VPS: el dispositivo aparecerá en http://localhost:7682/status
```

---

### 1C. ABRIR PUERTO RTSP (554) — Para sedes SDK que tengan router accesible

Si puedes acceder al router de la sede, abrir el puerto 554 da acceso RTSP directo (mejor que ISUP):

```
En el router de la sede:
1. Acceder al panel de administración del router
2. Port Forwarding / Reenvío de puertos / NAT
3. Agregar regla:
   - Puerto externo: 554 (o uno libre como 9554)
   - IP interna: la IP local del DVR (ej: 192.168.1.108)
   - Puerto interno: 554
   - Protocolo: TCP
4. Guardar

Además abrir puerto HTTP si es posible:
   - Puerto externo: 8080 (o libre)
   - IP interna: IP del DVR
   - Puerto interno: 80
   - Protocolo: TCP
```

**Si abres el puerto 554:** Avisarme con la IP pública y puerto, y lo agrego a go2rtc directamente — video real sin ISUP.

---

# PARTE 2: DAHUA

## Qué se configura en cada XVR Dahua

| Cambio | Por qué | Afecta grabación |
|--------|---------|-----------------|
| Substream → H.264 | Video fluido sin transcodificación | NO |
| Platform Access (Auto Register) | XVR se conecta al VPS — elimina IMOU | NO |

---

### SEDES DAHUA (todas sin IP pública)

| Sede | Serial Number | Canales | Acceso actual |
|------|--------------|---------|---------------|
| Brescia | AK01E46PAZ0BA9C | 17 | Web directo (186.97.104.202) |
| Hospital San Jerónimo | AE01C60PAZA4D94 | 16 | Solo P2P (SmartPSS) |
| Danubios | AJ00421PAZF2E60 | 9 | Solo P2P |
| Terrabamba | BB01B89PAJ5DDCD | 23 | Solo P2P |
| Santana | AB081E4PAZD6D5B | 7 | Solo P2P |
| Quintas de Santa María | AH1020EPAZ39E67 | 8 | Solo P2P |
| Patio Bonito | AL02505PAJDC6A4 | 12 | Solo P2P |
| Terrazzino | AL02505PAJ638AA | 18 | Solo P2P |
| Alborada | AL02505PAJD40E7 | 1 | Solo P2P |

---

### 2A. BRESCIA (tiene acceso web directo)

```
1. Abre: http://186.97.104.202
2. Login: admin / Clave.seg2023

CAMBIO 1 — Substream H.264:
3. Setup → Camera → Video (o Configuración → Cámara → Video)
4. Seleccionar canal en el dropdown superior
5. Pestaña: Sub Stream
6. Encode Mode (Codificación): H.264
7. Resolution: D1 (704×576) o 720P
8. Frame Rate: 10
9. Bit Rate: 768 Kbps
10. Apply (Guardar)
11. Repetir para cada canal (1 al 17)

CAMBIO 2 — Platform Access:
12. Setup → Network → Register
    (o Configuración → Red → Registro en Plataforma)
    (o Setup → Network → Platform Access)
    
    Si la opción dice "Auto Register":
13. Enable (Habilitar): ✅
14. Server Address (Dirección): 18.230.40.6
15. Server Port (Puerto): 7681
16. Device ID: AK01E46PAZ0BA9C (su serial)
17. Apply (Guardar)
```

---

### 2B. DEMÁS SEDES DAHUA (via SmartPSS)

```
1. Abrir SmartPSS en la PC
2. Device Manager → buscar el XVR por su serial
3. Click derecho → Device Config (Configuración del dispositivo)

CAMBIO 1 — Substream H.264:
4. Camera → Video → Sub Stream
5. Para cada canal:
   - Encode Mode: H.264
   - Resolution: D1 o 720P
   - Frame Rate: 10
   - Bit Rate: 768 Kbps
   - Guardar
6. Repetir para todos los canales

CAMBIO 2 — Platform Access:
7. Network → Register (o Auto Register o Platform Access)
8. Enable: ✅ (Activar)
9. Server Address: 18.230.40.6
10. Server Port: 7681
11. Device ID: (poner el serial del equipo, ej: AE01C60PAZA4D94)
12. Guardar

El XVR se conectará automáticamente al servidor.
No necesita IP pública — la conexión es de SALIDA.
```

**Si no encuentras "Register" o "Platform Access" en SmartPSS:**
```
Buscar en estas rutas alternativas:
- Network → TCP/IP → Registration
- Network → Platform Access  
- Network → Auto Register
- System → Platform Access
- Network → Center Registration

El nombre varía según el firmware del XVR.
Si no aparece ninguna opción similar, el firmware puede necesitar actualización.
```

---

### 2C. VIA DMSS (aplicación móvil) — SI SmartPSS no tiene la opción

```
1. Abrir DMSS en celular
2. Dispositivos → seleccionar el XVR
3. Configuración del dispositivo → Red → Registro
4. Habilitar → Dirección: 18.230.40.6 → Puerto: 7681
5. Guardar
```

---

# PARTE 3: ORDEN DE CONFIGURACIÓN RECOMENDADO

### Día 1 — Sedes con acceso web directo (más fácil)

| # | Sede | Marca | Qué hacer |
|---|------|-------|-----------|
| 1 | San Nicolás | Hikvision | H.264 substream (web) |
| 2 | Portalegre | Hikvision | H.264 substream (web) |
| 3 | La Palencia | Hikvision | H.264 substream (web) |
| 4 | Brescia | Dahua | H.264 substream + Platform Access (web) |

### Día 2 — Sedes Hikvision via iVMS-4200

| # | Sede | Qué hacer |
|---|------|-----------|
| 5 | San Sebastián | H.264 + ISUP (iVMS-4200) |
| 6 | Altagracia DVR1 | H.264 + ISUP (iVMS-4200) |
| 7 | Altagracia DVR2 | H.264 + ISUP (iVMS-4200) |
| 8 | Pisquines DVR | H.264 + ISUP (iVMS-4200) |
| 9 | Pisquines NVR | H.264 + ISUP (iVMS-4200) |
| 10 | Torre Lucia DVR | H.264 + ISUP (iVMS-4200) |
| 11 | Torre Lucia NVR | H.264 + ISUP (iVMS-4200) |
| 12 | Senderos | H.264 + ISUP (iVMS-4200) |
| 13 | Altos Rosario | H.264 + ISUP (iVMS-4200) |
| 14 | Brasil LPR1 | H.264 + ISUP (iVMS-4200) |
| 15 | Brasil LPR2 | H.264 + ISUP (iVMS-4200) |

### Día 3 — Sedes Dahua via SmartPSS

| # | Sede | Serial | Qué hacer |
|---|------|--------|-----------|
| 16 | Hospital | AE01C60PAZA4D94 | H.264 + Platform Access (SmartPSS) |
| 17 | Danubios | AJ00421PAZF2E60 | H.264 + Platform Access (SmartPSS) |
| 18 | Terrabamba | BB01B89PAJ5DDCD | H.264 + Platform Access (SmartPSS) |
| 19 | Santana | AB081E4PAZD6D5B | H.264 + Platform Access (SmartPSS) |
| 20 | Quintas | AH1020EPAZ39E67 | H.264 + Platform Access (SmartPSS) |
| 21 | Patio Bonito | AL02505PAJDC6A4 | H.264 + Platform Access (SmartPSS) |
| 22 | Terrazzino | AL02505PAJ638AA | H.264 + Platform Access (SmartPSS) |
| 23 | Alborada | AL02505PAJD40E7 | H.264 + Platform Access (SmartPSS) |

---

# PARTE 4: VERIFICACIÓN

### Después de configurar cada equipo

**Para H.264 substream:**
```
Abrir https://aionseg.co/live-view
La cámara debe verse fluida sin congelamiento
Si antes se congelaba y ahora fluye: H.264 funcionó
```

**Para ISUP/Platform Access:**
```
Esperar 2 minutos después de guardar
Avisarme a mí (Claude) con:
- Nombre de la sede
- Serial del equipo
- ¿Se conectó? (estado en iVMS-4200 o SmartPSS)

Yo verifico en el VPS que el equipo llegó al servidor
y lo configuro en go2rtc para que aparezca en la plataforma
```

---

# PARTE 5: RESUMEN DE DATOS DEL VPS

| Dato | Valor |
|------|-------|
| IP del servidor | 18.230.40.6 |
| Puerto Hikvision ISUP | 7660 |
| Puerto Dahua Platform Access | 7681 |
| Protocolo | TCP (conexión saliente desde el DVR/XVR) |
| ¿Necesita IP pública en la sede? | NO |
| ¿Necesita abrir puertos en router? | NO |
| ¿Afecta la grabación local? | NO |

---

# PARTE 6: PROBLEMAS COMUNES

### "No encuentro Platform Access en el menú"
→ El firmware puede ser antiguo. Verificar versión en: System → System Info
→ Hikvision: ISUP disponible desde firmware V4.30+ (2018+)
→ Dahua: Auto Register disponible desde firmware V2.800+ (2019+)
→ Si el firmware es muy viejo, necesita actualización

### "Dice conectado pero no aparece en el VPS"
→ Verificar que la dirección sea exactamente: 18.230.40.6
→ Verificar que el puerto sea correcto: 7660 (Hik) o 7681 (Dahua)
→ Verificar que el internet de la sede no bloquea puertos de salida
→ Contactar al ISP para verificar que TCP saliente está permitido

### "El substream sigue en H.265 después de cambiar"
→ Algunos DVR requieren reinicio después del cambio
→ En iVMS-4200: click derecho en DVR → Reboot (Reiniciar)
→ Esperar 2-3 minutos a que reinicie

### "El video se ve pixelado después del cambio"
→ Subir el bitrate de 768 a 1024 Kbps
→ O cambiar resolución de D1 a 720P

---

*Guía generada para Clave Seguridad CTA — AION Platform — Abril 2026*
