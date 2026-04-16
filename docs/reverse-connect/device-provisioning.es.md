# Guías de Configuración de Equipos

Instructivos paso a paso para apuntar los equipos de cada sitio al VPS AION.
Todos los pasos se hacen **una sola vez por equipo** durante la instalación.

**Datos del VPS central (válidos para Clave Seguridad CTA):**
- Dirección IP pública: `18.230.40.6`
- Puerto Dahua Auto Register: `7681`
- Puerto Hikvision ISUP: `7660` (señalización) / `7661` (media)

---

## A. Dahua (XVR, NVR, DVR, cámaras IP Dahua)

### A.1. Desde el OSD local (con monitor y ratón conectado al XVR)

1. Clic derecho → **Menú Principal** → pestaña **Red** (icono de globo).
2. En la columna izquierda, baja hasta **Registro Automático** (o *Auto Register* si el firmware está en inglés).
3. Configura:
   - **Activar:** encendido.
   - **No.:** `1` (solo un servidor central).
   - **Dirección del servidor:** `18.230.40.6`.
   - **Puerto:** `7681`.
   - **ID del dispositivo secundario:** usa el patrón `SITE<codigo>-<tipo><numero>`, por ejemplo `ELPOBLADO03-XVR01`. **Debe ser único en toda la flota.**
4. Clic en **Aplicar**. El **Estado** debería pasar de `Fuera de línea` a `En línea` en 10–30 segundos.
5. Si queda `Fuera de línea`: revisa §A.4.

### A.2. Desde el web (navegador apuntando a la IP local del XVR)

Mismo flujo en **Configuración → Red → Registro Automático**.

### A.3. Credenciales

- El XVR no guarda "credenciales para AION" — AION usa las **mismas credenciales de administrador del XVR** (las que usarías para entrar a la app DMSS/IMOU). Dáselas al supervisor que hará la aprobación en AION.
- Recomendado: crear un usuario dedicado llamado `aion` con permisos de **Monitor + PTZ + Playback** (no administrador completo). Reduce el riesgo si las credenciales se filtran.

### A.4. Troubleshooting Dahua

| Síntoma                                | Causa probable                          | Solución                              |
|----------------------------------------|-----------------------------------------|---------------------------------------|
| Estado en rojo: `Fuera de línea`       | Puerto 7681 saliente bloqueado en el ISP| Probar con tethering 4G/LTE           |
| Estado `En línea` pero no aparece en AION| Device ID duplicado                   | Cambiar el ID, añadir sufijo numérico |
| Aparece pero no muestra video          | Credenciales equivocadas en aprobación  | Desbloquear + re-aprobar con correctas|
| Se desconecta cada pocos minutos       | Internet inestable, NAT agresivo        | Ajustar router o cambiar ISP          |

---

## B. Hikvision (NVR, DVR, cámaras IP)

### B.1. Habilitar ISUP 5.0

1. Desde el OSD o desde `http://IP-LOCAL` del NVR, entra como admin.
2. **Configuración → Red → Configuración avanzada → Acceso a plataforma**.
3. Selecciona **Tipo de plataforma: ISUP 5.0** (algunos firmwares lo llaman *EHome*, es lo mismo — si solo aparece ISUP 2.0/3.0/4.1, actualiza el firmware).
4. Configura:
   - **Habilitar:** sí.
   - **Dirección del servidor:** `18.230.40.6`.
   - **Puerto:** `7660`.
   - **ID del dispositivo:** `SITE<codigo>-NVR01` (único).
   - **Clave:** una clave entre 8 y 32 caracteres alfanuméricos. **Guárdala** — la necesitas al aprobar en AION.
5. Guardar. El estado debe cambiar a **En línea** en 10–30 segundos.

### B.2. Credenciales

- La **Clave ISUP** es independiente de la contraseña de admin. Sirve solo como secreto compartido entre AION y el NVR.
- Cuando apruebes el equipo en AION te pedirá **tres cosas**: usuario admin, contraseña admin, y clave ISUP. Ten las tres a mano.

### B.3. Troubleshooting Hikvision

| Síntoma                                     | Causa probable                          | Solución                               |
|---------------------------------------------|-----------------------------------------|----------------------------------------|
| Estado `Sin conexión` rojo                  | Firewall del ISP o puerto 7660 saliente | Probar con otro ISP                    |
| Estado `En línea` pero AION no muestra video| Puerto 7661 saliente bloqueado          | Abrir 7661 TCP+UDP en router corporativo|
| Aparece y desaparece                        | Varios equipos con el mismo Device ID   | Cambiar uno                            |
| Firmware no muestra ISUP 5.0                | Firmware antiguo                        | Actualizar firmware vía Hik-Connect    |

---

## C. Convención de nombres (IMPORTANTE)

Todos los Device IDs deben seguir el formato:

```
<CODIGO-SITIO>-<TIPO><NUMERO>
```

Ejemplos válidos:
- `ELPOBLADO03-XVR01` (XVR Dahua en El Poblado sede 3)
- `LAURELES01-NVR01` (NVR Hikvision principal de Laureles)
- `ENVIGADO05-IPCAM07` (cámara IP independiente)

**No usar:**
- Solo números (`001`): imposible saber de dónde viene.
- Nombres del cliente sin código de sitio: se duplican.
- Espacios, tildes, ñ o caracteres especiales: rompen rutas internas.

---

## D. Checklist de cierre de instalación

Antes de abandonar el sitio, el técnico debe confirmar:

- [ ] Equipo configurado con Auto Register / ISUP apuntando al VPS.
- [ ] Device ID sigue la convención.
- [ ] Estado en el OSD del equipo: **En línea**.
- [ ] Supervisor recibió las credenciales por canal seguro (no WhatsApp).
- [ ] Supervisor aprobó el equipo en AION `/reverse` y confirmó video en vivo.
- [ ] Prueba de PTZ en al menos 1 cámara con motor.
- [ ] Foto del rack y del equipo con su Device ID visible, subida a AION `/sites/<id>/photos`.

Sin los 7 checks, no se cierra la orden de servicio.

---

**Clave Seguridad CTA · AION v1.1.0**
