# AION SECURITY PLATFORM
## Manual del Operador de Monitoreo

**Versión:** 2.0 | **Fecha:** Abril 2026 | **Empresa:** Clave Seguridad CTA
**Solo para personal autorizado**

---

# 1. Tu rol como operador

Como operador de la Central de Monitoreo, eres responsable de:
- Vigilar las 328 cámaras de las 25 sedes en tiempo real
- Responder a eventos y alertas de seguridad
- Gestionar el acceso de visitantes y vehículos
- Controlar puertas, sirenas y dispositivos remotamente
- Comunicarte con los guardias de cada sede
- Documentar incidentes y entregar turno

**Tu usuario es de tipo `operator` con acceso a los módulos de monitoreo.**

---

# 2. Inicio del turno

### 2.1 Ingreso al sistema

1. Abrir Chrome → **https://aionseg.co**
2. Email: tu email asignado
3. Password: tu contraseña
4. Verificar que el **Dashboard** carga correctamente

### 2.2 Checklist de inicio de turno

```
☐ Verificar Dashboard — todos los indicadores en verde
☐ Verificar Vista en Vivo — al menos 1 cámara por sede
☐ Revisar eventos pendientes del turno anterior
☐ Revisar incidentes abiertos
☐ Leer consignas especiales del día
☐ Verificar dispositivos IoT — online/offline
☐ Confirmar comunicación con guardia de cada sede (llamada o chat)
```

### 2.3 Recibir el turno

1. Ir a **Turnos** → ver la minuta del turno anterior
2. Leer las notas del operador saliente
3. Verificar que no hay incidentes sin resolver
4. Firmar la recepción del turno en el sistema

---

# 3. Monitoreo de video

### 3.1 Vista en vivo

**Ruta:** Menú → Vista en Vivo

1. **Seleccionar sede:** Desplegable arriba → elegir la sede
2. **Cambiar grid:** Botones 2x2, 3x3, 4x4
3. **Pantalla completa:** Doble clic en cualquier cámara
4. **Navegar:** Flechas para pasar a la siguiente página de cámaras
5. **Volver:** Clic en el botón de grid o presionar ESC

### 3.2 Rutina de monitoreo recomendada

```
Cada 15 minutos:
  1. Revisar Torre Lucia (24 cámaras) — grid 4x4, 2 páginas
  2. Revisar Pisquines (32 cámaras) — grid 4x4, 2 páginas
  3. Revisar Altagracia (33 cámaras) — grid 4x4, 3 páginas
  4. Revisar sedes restantes en rotación

Cada hora:
  1. Verificar Dashboard — revisar indicadores
  2. Revisar eventos nuevos
  3. Verificar dispositivos offline

Cada cambio de turno:
  1. Revisar TODAS las sedes al menos una vez
  2. Documentar novedades
  3. Entregar minuta al siguiente operador
```

### 3.3 Qué hacer si una cámara no carga

1. Esperar 10 segundos — puede ser latencia de red
2. Recargar la página del navegador (F5)
3. Si no funciona → verificar en Dashboard si la sede tiene problemas de conectividad
4. Si la sede está offline → llamar al guardia de la sede por extensión (200-220)
5. Si persiste → crear incidente: "Cámara X de sede Y no disponible"

---

# 4. Gestión de eventos

### 4.1 Cuando aparece un evento nuevo

1. El sistema muestra una notificación visual y sonora
2. Verificar la severidad:
   - **Crítico (rojo):** Atender inmediatamente — máximo 5 minutos
   - **Alto (naranja):** Atender en los próximos 15 minutos
   - **Medio (amarillo):** Atender cuando sea posible
   - **Bajo/Info (azul/gris):** Revisar, reconocer y continuar

### 4.2 Procedimiento para eventos críticos

```
1. RECONOCER el evento inmediatamente (clic en "Reconocer")
2. VERIFICAR las cámaras de la sede afectada
3. LLAMAR al guardia de la sede (extensiones 200-220)
4. EVALUAR si es una falsa alarma o un incidente real
5. Si es REAL:
   a. Crear incidente desde el evento (botón "Crear Incidente")
   b. Asignar prioridad
   c. Activar protocolo de emergencia si aplica
   d. Notificar al supervisor (extensión 103/104)
6. Si es FALSA ALARMA:
   a. Descartar el evento con razón: "Falsa alarma — [motivo]"
```

### 4.3 Reconocer eventos en lote

Para eventos informativos o de baja prioridad:
1. Filtrar por severidad: "info" o "low"
2. Seleccionar todos → "Reconocer seleccionados"
3. O usar el asistente IA: "Reconoce todos los eventos informativos"

---

# 5. Control de dispositivos

### 5.1 Abrir una puerta remotamente

1. Ir a **Domótica**
2. Buscar la sede
3. Encontrar el dispositivo de puerta (tipo: door/relay)
4. Clic en **"Abrir"** → la puerta abre por 3 segundos y cierra automáticamente

**También puedes decirle al asistente IA:**
> "Abre la puerta de Torre Lucia"

### 5.2 Activar sirena

1. Ir a **Domótica**
2. Buscar la sirena de la sede
3. Clic en **"Activar"** → la sirena suena por 10 segundos (configurable)

**PRECAUCIÓN:** Solo activar sirenas en caso de emergencia real.

### 5.3 Controlar iluminación

1. Ir a **Domótica**
2. Buscar el dispositivo de luz/relé
3. Toggle ON/OFF

---

# 6. Control de acceso

### 6.1 Buscar un residente

1. Ir a **Residentes**
2. En la barra de búsqueda, escribir:
   - Nombre (ej: "LÓPEZ")
   - Documento (ej: "1017123456")
   - Apartamento (ej: "301")
   - Teléfono
3. Los resultados aparecen inmediatamente

**Con el asistente IA:**
> "Busca al residente del apto 301 en Torre Lucia"

### 6.2 Verificar un vehículo

1. Ir a **Vehículos**
2. Buscar por placa (ej: "ABC123")
3. Verificar que el vehículo está registrado y activo
4. Si no aparece → negar acceso y registrar en el log

**Con el asistente IA:**
> "Busca la placa ABC123"

### 6.3 Registrar un visitante

1. Ir a **Visitantes** → **Nuevo Visitante**
2. Llenar:
   - Nombre completo
   - Documento de identidad
   - A quién visita (residente, apto)
   - Propósito de la visita
3. Guardar → se genera un registro con hora de entrada
4. Cuando el visitante sale → marcar "Salida"

### 6.4 Verificar consignas

Antes de autorizar acceso a un apartamento:
1. Ir a **Datos Operativos → Consignas**
2. Filtrar por número de unidad
3. Leer las instrucciones especiales
4. Cumplir lo indicado en la consigna

---

# 7. Comunicación

### 7.1 Llamar a una sede

**Desde teléfono IP de la central:**
- Marcar la extensión de la sede (ver tabla):

| Extensión | Sede |
|-----------|------|
| 200 | Torre Lucia |
| 201 | San Nicolás |
| 202 | Alborada |
| 203 | Brescia |
| 204 | Patio Bonito |
| 205 | Pisquines |
| 206 | San Sebastián |
| 207 | Terrabamba |
| 208 | Altos del Rosario |
| 209 | Senderos |
| 210 | Danubios |
| 211 | Terrazzino |
| 212 | Portal Plaza |
| 213 | Portalegre |
| 214 | Altagracia |

### 7.2 Extensiones internas

| Extensión | Nombre |
|-----------|--------|
| 099 | Central AION |
| 103 | Supervisor 1 |
| 104 | Supervisor 2 |
| 107 | Admin Isabella |
| 111 | Emergencias |

### 7.3 Usar el asistente IA para comunicarse

> "Envía una alerta al supervisor: evento crítico en San Nicolás sin resolver"

El asistente IA puede enviar notificaciones por email, Telegram o WhatsApp según la configuración.

---

# 8. Incidentes

### 8.1 Crear un incidente

1. Ir a **Incidentes** → **Nuevo Incidente**
2. Título: descripción breve y clara (ej: "Intrusión detectada zona de parqueaderos Brescia")
3. Prioridad:
   - **Crítica:** Intrusión, agresión, incendio, emergencia médica
   - **Alta:** Puerta forzada, persona sospechosa, falla de cámara en zona sensible
   - **Media:** Acceso no autorizado, dispositivo offline
   - **Baja:** Mantenimiento, consulta, evento menor
4. Descripción: qué pasó, cuándo, dónde, acciones tomadas
5. Sede afectada
6. Guardar

### 8.2 Seguimiento de un incidente

1. Agregar **comentarios** con cada actualización
2. Cambiar **estado** según avance:
   - Abierto → En progreso (cuando empiezas a atenderlo)
   - En progreso → Resuelto (cuando se soluciona)
   - Resuelto → Cerrado (confirmación final)
3. Si no se resuelve en 30 minutos → **escala automáticamente** al supervisor

### 8.3 Con el asistente IA:

> "Crea un incidente: persona sospechosa rondando el parqueadero de San Nicolás, prioridad alta"
> "Agrega un comentario al incidente 5: policía notificada, patrulla en camino"
> "Cierra el incidente 5: persona identificada como residente, falsa alarma"

---

# 9. Emergencias

### 9.1 Protocolo de incendio

```
1. ACTIVAR PROTOCOLO DE EMERGENCIA EN EL SISTEMA
   → Ir a Emergencias → Activar Protocolo de Incendio → Seleccionar sede
   O decirle al IA: "Activa protocolo de incendio en Torre Lucia"

2. EL SISTEMA AUTOMÁTICAMENTE:
   → Activa sirenas de la sede
   → Crea incidente con prioridad CRÍTICA
   → Notifica al supervisor por Telegram
   → Envía WhatsApp al administrador de la sede

3. TÚ DEBES:
   → Llamar a BOMBEROS: 119
   → Llamar al guardia de la sede: ext 200 (Torre Lucia)
   → Verificar cámaras para evaluar la situación
   → Documentar todo en la línea de tiempo del incidente
   → NO desactivar la sirena hasta confirmar que es seguro
```

### 9.2 Protocolo de intrusión/brecha de seguridad

```
1. ACTIVAR LOCKDOWN
   → Ir a Emergencias → Activar Brecha de Seguridad → Seleccionar sede
   O decirle al IA: "Activa lockdown en Brescia"

2. EL SISTEMA AUTOMÁTICAMENTE:
   → Cierra todas las puertas de la sede
   → Crea incidente CRÍTICO
   → Graba snapshots de todas las cámaras
   → Notifica a todos los supervisores

3. TÚ DEBES:
   → Llamar a POLICÍA: 123
   → Llamar al guardia de la sede
   → Mantener monitoreo visual constante de las cámaras
   → Documentar movimiento del sospechoso
   → Esperar instrucciones del supervisor
```

### 9.3 Protocolo de emergencia médica

```
1. ACTIVAR PROTOCOLO MÉDICO
   → Ir a Emergencias → Activar Emergencia Médica → Seleccionar sede

2. EL SISTEMA AUTOMÁTICAMENTE:
   → Crea incidente (SIN sirena — no alarmar a los residentes)
   → Notifica a la administración

3. TÚ DEBES:
   → Llamar a AMBULANCIA: 123
   → Llamar al guardia para que asista en la ubicación
   → Facilitar acceso al personal médico (abrir puertas remotamente)
   → Documentar en el incidente
```

---

# 10. Entrega de turno

### 10.1 Al finalizar tu turno

```
1. Revisar que NO hay incidentes abiertos sin documentar
2. Revisar eventos pendientes — reconocer los que sean de bajo impacto
3. Escribir la MINUTA de turno:
   ├── Novedades importantes
   ├── Incidentes abiertos y su estado
   ├── Equipos con fallas
   ├── Consignas especiales para el siguiente turno
   └── Observaciones generales
4. Guardar la minuta en el sistema
5. Informar verbalmente al operador entrante
6. Cerrar sesión
```

---

# 11. Uso del asistente IA — Guía rápida

El asistente IA está en el menú lateral como **"Asistente IA"**.

### Comandos más útiles:

| Lo que quieres hacer | Qué decirle al IA |
|---------------------|-------------------|
| Ver resumen general | "Dame el resumen del dashboard" |
| Buscar residente | "Busca al residente PÉREZ del apto 502" |
| Buscar vehículo | "Busca la placa ABC 123" |
| Ver cámaras de una sede | "¿Cuántas cámaras tiene Brescia?" |
| Abrir puerta | "Abre la puerta de San Nicolás" |
| Activar sirena | "Activa la sirena de Altagracia por 10 segundos" |
| Crear incidente | "Crea incidente: puerta forzada en Pisquines, prioridad alta" |
| Ver incidentes abiertos | "¿Cuántos incidentes hay abiertos?" |
| Estado de una sede | "¿Cuál es el estado de Torre Lucia?" |
| Turno actual | "¿Quién está de turno ahora?" |
| Buscar en protocolos | "¿Cuál es el protocolo de incendio?" |
| Verificar dispositivos | "¿Cuántos dispositivos están offline?" |
| Ver estado del sistema | "Verifica la salud del sistema" |

---

# 12. Solución de problemas comunes

| Problema | Solución |
|----------|----------|
| No carga el video | Recargar página (F5). Si persiste, verificar conectividad de la sede |
| No puedo iniciar sesión | Verificar email/password. Si olvidaste el password, contactar supervisor |
| Un dispositivo aparece offline | Esperar 5 min. Si persiste, crear incidente para el técnico |
| La sirena no responde | Verificar en Domótica si el dispositivo está online. Si no, reportar |
| El asistente IA no responde | Reformular la pregunta. Si no funciona, usar la interfaz manual |
| No puedo abrir una puerta | Verificar que el dispositivo está online. Intentar de nuevo. Si falla, llamar al guardia |
| El dashboard muestra 0 en todo | Es normal si no hay eventos recientes. Verificar que la API responde |

---

*Manual confidencial — Clave Seguridad CTA*
*Prohibida su distribución sin autorización*
