# Manual del Operador · AION Reverse Connect

**Audiencia:** operadores de central y técnicos de instalación de Clave Seguridad CTA.
**Versión:** v1.1.0 · Abril 2026.
**Idioma:** español (Colombia).

---

## 1. Qué es y qué no es

AION Reverse Connect permite que los DVR, NVR y cámaras IP **inicien la conexión** hacia el servidor central de AION, sin necesidad de IP pública en el sitio, sin reenvío de puertos en el router, y sin pasar por las nubes de los fabricantes (IMOU, Hik-Connect).

**Sí hace:**
- Registro automático de equipos Dahua (Auto Register / DVRIP).
- Registro automático de equipos Hikvision (ISUP 5.0).
- Video en vivo, grabado, PTZ, snapshots y eventos de alarma.
- Aprobación por operador antes de que un equipo pueda enviar video.
- Bitácora (audit log) de quién aprobó, bloqueó o modificó qué equipo.

**No hace:**
- No reemplaza la instalación física ni el cableado.
- No funciona si el sitio no tiene Internet saliente hacia el VPS.
- No reemplaza las cámaras analógicas conectadas al DVR — sigue siendo el DVR el que digitaliza; AION solo recibe el stream final.

---

## 2. Cómo saber que todo está bien (en 10 segundos)

Abre `https://aionseg.co/reverse`. En la cabecera verás tres números:

| Indicador         | Qué significa                                                      | Valor sano                        |
|-------------------|--------------------------------------------------------------------|-----------------------------------|
| **En línea**      | Sesiones activas reportando ahora                                  | Entre 22 y el total de equipos    |
| **Aprobados**     | Equipos con credenciales guardadas y permiso para conectar         | Debe igualar el total instalado   |
| **Por aprobar**   | Equipos nuevos que tocaron el VPS pero nadie los ha autorizado aún | En condición normal: **0**        |

Si "Por aprobar" > 0, revisa la pestaña **Dispositivos** — hay equipos esperando.

---

## 3. Aprobar un equipo nuevo (flujo más común)

1. Ve a `/reverse` → pestaña **Dispositivos**.
2. Busca la fila con estado **pending_approval**. El `Device ID` que aparece es lo que digitaste en el DVR/NVR al configurarlo.
3. Haz clic en **Aprobar**.
4. En el diálogo:
   - **Nombre para mostrar:** nombre legible (por ejemplo, *Portería El Poblado 03*).
   - **Usuario / Contraseña:** las credenciales del DVR (las mismas con las que entrarías por la app del fabricante).
   - **ISUP Key** (solo Hikvision): la clave que configuraste en *Red → Acceso a Plataforma → ISUP 5.0 → Clave*.
   - **Canales:** cuántas cámaras tiene conectadas el equipo.
5. Clic en **Aprobar y conectar**.
6. En segundos la fila pasa a **approved** y aparece una sesión activa en la pestaña **Sesiones activas**.

> **Importante:** una vez aprobado, las credenciales quedan cifradas con AES-256 y **nunca más son visibles desde la interfaz**. Para rotarlas, bloquea el equipo y vuelve a aprobarlo.

---

## 4. Ver video en vivo

1. Pestaña **Sesiones activas**.
2. Clic en la tarjeta del sitio.
3. Selecciona cuántos canales ver a la vez (1, 4, 9, 16).
4. Clic en cualquier cuadro para activarlo — el joystick PTZ abajo queda asociado a ese canal.

Si un cuadro queda en "Conectando…" por más de 10 segundos:
- Verifica el punto de humo de §7.

---

## 5. Usar el PTZ

- **Mantén pulsado** un botón direccional para mover; al soltar, la cámara se detiene automáticamente.
- La velocidad va de 1 (lento) a 8 (rápido).
- El botón **Snapshot** descarga un JPEG del canal activo.
- Si el botón no responde, puede ser que la cámara analógica no tenga alimentación para el motor (24 V), no un problema de AION.

---

## 6. Bloquear / desbloquear un equipo

Un equipo bloqueado:
- **No puede reconectar.** El VPS cierra la conexión apenas intenta registrarse.
- Sus credenciales quedan guardadas cifradas — no hay que volver a digitarlas al desbloquear.

Casos típicos de bloqueo:
- Equipo dado de baja por el cliente.
- Sospecha de manipulación.
- Cambio de propiedad del inmueble.

Para bloquear: pestaña **Dispositivos** → botón de acciones → **Bloquear** → describe el motivo (queda en la bitácora).

---

## 7. Punto de humo cuando un sitio no conecta

Sigue esta checklist en orden; al primero que falle, hay probable causa:

1. **¿El sitio tiene Internet?** Pregúntale al propietario o al vigilante; haz ping al router desde la central si tiene IP conocida.
2. **¿El equipo está encendido?** Luz de disco parpadeando, ventilador funcionando.
3. **¿Está configurada la dirección del VPS?**
   - Dahua: *Red → Registro Automático → Dirección del servidor* debe ser `18.230.40.6` y puerto `7681`.
   - Hikvision: *Red → Plataforma → ISUP 5.0* debe estar habilitado, IP `18.230.40.6`, puerto `7660`, versión `5.0`.
4. **¿El ID del dispositivo es único?** Si dos sitios tienen el mismo Device ID, el segundo no podrá registrarse.
5. **¿Está aprobado en AION?** Pestaña **Dispositivos**; si aparece como `pending_approval`, apruébalo.
6. **¿Está bloqueado?** Si aparece como `blocked`, ese es el problema.
7. **¿El ISP del cliente bloquea el puerto 7660/7681 saliente?** Poco común pero posible; contacta al equipo de soporte de AION con el sitio y la hora para revisar logs.

---

## 8. Qué NO hacer

- **No compartas credenciales por WhatsApp ni por correo.** Cárgalas directamente en el diálogo de aprobación.
- **No uses el mismo Device ID** en dos equipos distintos. Siempre incluye el código del sitio (`SITE03-XVR01`).
- **No reinicies el VPS** ni el servicio `aion-reverse-gateway` durante horas de monitoreo (7:00 AM–11:00 PM) sin avisar. Las sesiones se reestablecen automáticamente pero hay 30–60 segundos de ceguera.
- **No toques** la configuración `go2rtc` existente. El gateway añade sus propios streams con prefijo `rv_`; cualquier cambio fuera de ese prefijo es del equipo de plataforma.

---

## 9. Glosario rápido

| Término        | Significado práctico                                                                   |
|----------------|-----------------------------------------------------------------------------------------|
| DVR            | Grabadora de video digital, para cámaras analógicas.                                    |
| NVR            | Grabadora de red, para cámaras IP.                                                      |
| XVR            | DVR híbrido (analógico + IP) de Dahua.                                                  |
| DVRIP          | Protocolo propietario de Dahua para comunicarse con sus equipos.                        |
| ISUP           | "Internet Service Uploading Protocol" de Hikvision — versión 5.0.                       |
| Auto Register  | Modo en que el DVR llama al servidor en vez de esperar conexiones entrantes.            |
| Reverse-connect| Traducción técnica del anterior: conexión en sentido contrario al tradicional.          |
| Device ID      | Identificador libre que tú eliges para cada equipo; debe ser único en toda la flota.    |
| ISUP Key       | Clave compartida entre el NVR Hikvision y AION. No confundir con la contraseña de admin.|
| Sesión         | Una conexión activa entre un equipo y AION, que dura mientras el equipo se reporta.     |
| Heartbeat      | Latido que el equipo manda cada 20–30 segundos para decir "sigo vivo".                  |

---

## 10. Contactos de soporte

| Situación                             | A quién contactar                                       |
|---------------------------------------|---------------------------------------------------------|
| Un sitio no reporta y §7 no resuelve  | Isabella — líder de plataforma — Telegram / WhatsApp    |
| Sospecha de ataque o compromiso       | Bloquea el equipo, luego llama a Isabella inmediatamente|
| Error en la interfaz (pantalla blanca)| Refresca, luego reporta con captura de pantalla         |
| Necesitas capacitación de un operador | Solicita al supervisor del turno                        |

---

**Clave Seguridad CTA · AION · Medellín, Colombia**
