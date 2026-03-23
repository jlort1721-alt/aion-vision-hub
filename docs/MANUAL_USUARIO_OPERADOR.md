# Clave Seguridad — Manual de Usuario para Operadores

> Guía completa para operadores de la central de monitoreo
> Versión 1.0 — Marzo 2026

---

## Tabla de Contenidos

1. [Inicio de Sesión](#1-inicio-de-sesión)
2. [Panel Principal (Dashboard)](#2-panel-principal-dashboard)
3. [Vista en Vivo](#3-vista-en-vivo)
4. [Eventos](#4-eventos)
5. [Incidentes](#5-incidentes)
6. [Alertas](#6-alertas)
7. [Dispositivos](#7-dispositivos)
8. [Sitios](#8-sitios)
9. [Control de Acceso](#9-control-de-acceso)
10. [Visitantes](#10-visitantes)
11. [Citofonía IP](#11-citofonía-ip)
12. [Domóticos](#12-domóticos)
13. [Patrullas](#13-patrullas)
14. [Turnos y Guardias](#14-turnos-y-guardias)
15. [SLA](#15-sla)
16. [Emergencias](#16-emergencias)
17. [Reportes](#17-reportes)
18. [WhatsApp](#18-whatsapp)
19. [Asistente IA](#19-asistente-ia)
20. [Reproducción (Playback)](#20-reproducción-playback)
21. [Base de Datos](#21-base-de-datos)
22. [Reinicios](#22-reinicios)
23. [Automatización](#23-automatización)
24. [Búsqueda Global](#24-búsqueda-global)
25. [Notificaciones](#25-notificaciones)
26. [Cambio de Idioma](#26-cambio-de-idioma)
27. [Atajos de Teclado](#27-atajos-de-teclado)

---

## 1. Inicio de Sesión

### Acceder a la Plataforma

1. Abrir el navegador (Chrome, Edge, Firefox, Safari)
2. Ir a la URL proporcionada por el administrador
3. En la pantalla de login, ingresar:
   - **Correo Electrónico**: El correo asignado por el administrador
   - **Contraseña**: La contraseña asignada
4. Clic en **Iniciar Sesión**

### Recuperar Contraseña

1. En la pantalla de login, clic en **¿Olvidaste tu contraseña?**
2. Ingresar el correo electrónico
3. Clic en **Enviar Enlace**
4. Revisar el correo y seguir las instrucciones

### Cerrar Sesión

1. En la barra lateral inferior, clic en tu avatar/nombre
2. Seleccionar **Cerrar Sesión**

---

## 2. Panel Principal (Dashboard)

El Dashboard es la primera pantalla que se ve al iniciar sesión. Muestra un resumen operativo en tiempo real.

### Tarjetas de Resumen (KPIs)

| Tarjeta | Qué Muestra | Clic Lleva a |
|---------|-------------|-------------|
| Total Dispositivos | Cantidad total, cuántos online/offline | Dispositivos |
| Alertas Activas | Alertas sin resolver, críticas/altas | Eventos |
| Sitios | Total de sitios, cuántos saludables | Sitios |
| Salud del Sistema | Componentes OK del sistema | Salud del Sistema |

### Gráficas

- **Eventos por Hora (24h)**: Barras mostrando volumen de eventos con resaltado de críticos
- **Estado de Dispositivos**: Donut mostrando distribución online/offline
- **Línea de Tiempo (7 días)**: Área apilada por severidad
- **Alertas por Sitio**: Barras horizontales mostrando sitios más activos
- **Distribución por Severidad**: Pie chart de eventos por severidad

### Secciones Adicionales

- **Eventos Recientes**: Lista de los 5 eventos más recientes con severidad y estado
- **Salud del Sistema**: Estado de cada componente (BD, cache, streaming, etc.)
- **Dispositivos por Sitio**: Lista de sitios con conteo de dispositivos online
- **Acciones Rápidas**: Botones para agregar dispositivo, vista en vivo, nuevo incidente, asistente IA

### Notificaciones Push

- **Activar**: Clic en "Activar Notificaciones" para recibir alertas del navegador
- **Desactivar**: Clic en "Desactivar" si ya están habilitadas

---

## 3. Vista en Vivo

### Acceder

Clic en **Vista en Vivo** en la barra lateral, o desde el Dashboard en **Abrir Vista en Vivo**.

### Seleccionar Tamaño de Grilla

En la parte superior, seleccionar el layout:
- **1×1**: Una cámara a pantalla completa
- **2×2**: 4 cámaras
- **3×3**: 9 cámaras
- **4×4**: 16 cámaras (más común en monitoreo)
- **5×5**: 25 cámaras
- **6×6**: 36 cámaras

### Asignar Cámaras a la Grilla

1. En la barra lateral izquierda se listan todas las cámaras disponibles
2. **Arrastrar** una cámara desde la lista y **soltar** en una celda de la grilla
3. La cámara comienza a transmitir automáticamente
4. Para **mover** una cámara: arrastrar de una celda a otra
5. Para **quitar** una cámara: hover sobre la celda → clic en la X

### Filtrar por Sitio

En el dropdown superior, seleccionar un sitio específico para ver solo sus cámaras.

### Controles por Cámara

Al pasar el mouse sobre una cámara activa:
- **Maximizar**: Ver a pantalla completa
- **Captura**: Tomar screenshot
- **Volumen**: Activar/silenciar audio
- **Actualizar**: Reconectar el stream
- **Quitar**: Remover de la grilla

### Guardar Layout

1. Configurar las cámaras en la posición deseada
2. Clic en **Guardar Layout**
3. Ingresar un nombre (ej: "Turno Noche - Perimetral")
4. Opcionalmente marcar "Compartir con equipo"
5. Clic en **Guardar**

### Cargar Layout Guardado

1. Clic en **Cargar Layout**
2. Seleccionar de la lista de layouts guardados
3. Las cámaras se restauran automáticamente a sus posiciones

### Indicadores de Estado

- **Punto verde**: Cámara online y transmitiendo
- **Punto rojo**: Cámara offline o sin conexión
- **Badge de marca**: Muestra el fabricante (HIK, DH, etc.)

---

## 4. Eventos

### Pantalla de Eventos

Muestra todos los eventos de seguridad en tiempo real.

### Filtrar Eventos

| Filtro | Opciones |
|--------|----------|
| Severidad | Todos, Crítico, Alto, Medio, Bajo, Info |
| Estado | Todos, Nuevo, Reconocido, Resuelto, Descartado |
| Dispositivo | Selector de dispositivo específico |
| Sitio | Selector de sitio |
| Fecha | Desde — Hasta |

### Acciones sobre un Evento

| Acción | Descripción |
|--------|-------------|
| **Reconocer** | Marca que ya viste el evento |
| **Resolver** | Marca como resuelto |
| **Descartar** | Descarta como falso positivo |
| **Crear Incidente** | Escala a investigación |
| **Resumen IA** | Genera resumen inteligente |

### Paginación

Los eventos se paginan (20 por página). Navegar con las flechas de **Página X de Y**.

---

## 5. Incidentes

### ¿Qué es un Incidente?

Un incidente es una investigación que agrupa uno o más eventos y requiere seguimiento.

### Crear Incidente

1. Clic en **Nuevo Incidente** o desde un evento → **Crear Incidente**
2. Llenar:
   - **Título**: Descripción corta
   - **Descripción**: Detalle del incidente
   - **Prioridad**: Crítico, Alto, Medio, Bajo
3. Clic en **Crear Incidente**

### Gestionar Incidente

- **Asignar**: Asignar a un operador específico
- **Agregar evidencia**: Adjuntar capturas, archivos
- **Comentar**: Agregar notas de seguimiento
- **Resumen IA**: Generar resumen automático
- **Resolver**: Marcar como resuelto
- **Cerrar**: Cerrar definitivamente

### Vista de Detalle

Al seleccionar un incidente:
- Panel lateral con toda la información
- Timeline de eventos relacionados
- Historial de actividad y comentarios
- Estado y prioridad con badges de color

---

## 6. Alertas

### Pestaña: Alertas Activas

Muestra todas las alertas en tiempo real que requieren atención.

| Información | Descripción |
|-------------|-------------|
| Título | Descripción de la alerta |
| Severidad | Crítico (rojo), Alto (naranja), Medio (amarillo), Bajo (verde) |
| Estado | Activa, Reconocida, Resuelta |
| Hora | Cuándo se generó |

**Acciones:**
- **Reconocer**: Indica que el operador está al tanto
- **Resolver**: Cierra la alerta

### Pestaña: Reglas

Las reglas definen cuándo se genera una alerta. Cada regla tiene:
- Nombre y descripción
- Severidad
- Conteo de veces activada
- Toggle para activar/desactivar

### Pestaña: Escalamiento

Políticas que definen qué pasa cuando una alerta no se atiende a tiempo:
- Nivel 1: Notificar al operador de turno
- Nivel 2: Notificar al supervisor (si no se atiende en X minutos)
- Nivel 3: Escalar a gerencia

### Pestaña: Canales

Medios por los que se envían las notificaciones:
- Email
- WhatsApp
- Webhook
- Push (navegador)
- Slack / Teams

---

## 7. Dispositivos

### Lista de Dispositivos

Tabla con todos los dispositivos registrados:

| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre descriptivo |
| Marca/Modelo | Fabricante y modelo |
| IP Pública | IP remota/WAN |
| IP LAN | IP local del dispositivo |
| Sitio | Ubicación asignada |
| Tipo | Cámara, NVR, sensor, etc. |
| Estado | Online (verde) / Offline (rojo) |

### Filtros

- **Búsqueda**: Por nombre, IP, IP remota, WAN
- **Marca**: Hikvision, Dahua, ONVIF, todas
- **Estado**: Online, offline, pending, todos

### Detalle del Dispositivo

Al clic en un dispositivo, se abre panel lateral con:
- Información de conexión (IP, puertos, RTSP, ONVIF)
- Firmware y canales
- Capacidades (PTZ, audio, analytics)
- Tags y notas operativas

### Acciones

- **Agregar**: Botón "Agregar Dispositivo"
- **Editar**: Modificar configuración
- **Eliminar**: Remover del sistema
- **Probar Conexión**: Verificar conectividad

---

## 8. Sitios

### Mapa

Vista de mapa con marcadores por sitio. Los colores indican:
- **Verde**: Saludable, todos los dispositivos OK
- **Amarillo**: Degradado, algunos dispositivos con problemas
- **Rojo**: Fuera de línea, sin conectividad

### Lista de Sitios

Tarjetas con:
- Nombre y dirección
- Conteo de dispositivos y cámaras
- Estado de salud
- Clic para ver detalle

### Detalle del Sitio

- Dirección, zona horaria, coordenadas
- IP WAN
- Lista de dispositivos con estado individual
- Acciones: editar, eliminar

---

## 9. Control de Acceso

### Pestaña: Personas

Registro de personas con acceso al inmueble:

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre completo |
| Sección | Torre, bloque, zona |
| Unidad | Apto, oficina, local |
| Tipo | Residente, visitante, personal |
| Teléfono | Contacto |
| Documento | Número de identificación |

**Acciones**: Agregar, editar, eliminar personas.

### Pestaña: Bitácora

Registro de entradas y salidas:
- Hora
- Dirección (Entrada/Salida/Intento)
- Método (tarjeta, código, biométrico, manual)
- Sección
- Notas del operador

### Pestaña: Vehículos

Registro de vehículos autorizados:
- Placa
- Marca y modelo
- Color
- Tipo (carro, moto, bicicleta)
- Propietario vinculado

### Pestaña: LPR Scanner

Simulador de lectura de placas por cámara:
- Buffer de placas detectadas
- Estado: autorizado / desconocido
- Porcentaje de confianza

### Pestaña: Reportes

Exportación de datos por período:
- Diario, semanal, quincenal, mensual
- Formato CSV/Excel
- Incluye accesos, personas, vehículos

### Pestaña: Credenciales

Configuración de métodos de acceso:
- RFID / NFC
- PIN
- Biométrico
- QR

---

## 10. Visitantes

### Pestaña: Visitantes

Lista de visitantes registrados:
- Nombre completo con empresa
- Razón de visita
- Conteo de visitas previas
- Estado de lista negra (si aplica)

### Pestaña: Pases

Pases de acceso temporal:
- Nombre del visitante
- Tipo de pase (daily, temporary, permanent)
- Estado: activo, usado, expirado, revocado
- Validez (fecha inicio — fecha fin)

**Acciones sobre pases:**
- **Check In**: Registrar entrada del visitante
- **Check Out**: Registrar salida
- **Revocar**: Cancelar pase

### Pestaña: Escáner QR

Validación manual de códigos QR:
1. Ingresar o escanear el token QR
2. Clic en **Validar**
3. El sistema muestra:
   - Si el pase es válido o inválido
   - Nombre del visitante y empresa
   - Estado del pase y fecha de expiración
   - Botón de Check-In si es válido

---

## 11. Citofonía IP

### Pestaña: Dispositivos

Lista de citófonos IP:
- Nombre, sección, marca/modelo
- IP y URI SIP
- Estado: online/offline
- Botones: llamar, refrescar

### Pestaña: Historial de Llamadas

Registro de todas las llamadas:
- Hora
- Dirección (entrante/saliente)
- Sección
- Duración
- Atendido por (operador humano / agente IA / mixto)
- Estado

### Pestaña: WhatsApp

Información de integración WhatsApp Business con citofonía.

### Pestaña: Voz IA

Configuración del agente de voz inteligente:

**Estado del Proveedor**: Indicador de conexión con ElevenLabs
- Estado: conectado (verde) / desconectado (rojo)
- Latencia, tier, cuota restante

**Modo de Atención**: Selector de cómo se atienden las llamadas
- Operador Humano
- Agente IA
- Modo Mixto

**Selección de Voz**: Dropdown con voces disponibles
- Nombre, género, idioma de cada voz

**Plantillas de Saludo**: 4 plantillas con botón de reproducción
- Saludo por defecto
- Fuera de horario
- Emergencia
- Mantenimiento

---

## 12. Domóticos

### Vista Principal

Tabla de dispositivos domóticos (interruptores, enchufes, relés):

| Columna | Descripción |
|---------|-------------|
| Tipo | Ícono del tipo de dispositivo |
| Nombre | Nombre descriptivo |
| Tipo | Badge de categoría |
| Sección | Ubicación |
| Marca/Modelo | Fabricante |
| Estado | Online/Offline |
| Encendido | Toggle on/off |

### Acciones

- **Toggle**: Encender/apagar dispositivo (clic en el switch)
- **Probar Conexión**: Verificar que el dispositivo responde
- **Historial**: Ver acciones realizadas
- **Eliminar**: Remover dispositivo

### Integración eWeLink

Si hay dispositivos Sonoff/eWeLink:
1. Clic en el ícono de eWeLink
2. Autenticarse con la cuenta eWeLink
3. Los dispositivos vinculados aparecen automáticamente
4. Sincronizar para actualizar la lista

---

## 13. Patrullas

### Pestaña: Seguimiento en Vivo

Mapa táctico mostrando:
- Posición de guardias (marcadores verdes = a tiempo, rojos = SLA violado)
- Nodos de checkpoints
- Líneas de ruta de patrulla
- Temporizadores SLA con barras de progreso:
  - Verde: dentro del SLA
  - Amarillo: próximo a vencer
  - Rojo: SLA violado → botón "Despachar Refuerzo"

### Pestaña: Rutas

Definición de rutas de patrulla:
- Nombre de la ruta
- Sitio asignado
- Tiempo estimado de recorrido
- Frecuencia
- Toggle activo/inactivo
- Enlace para ver checkpoints

### Pestaña: Checkpoints

Lista numerada de puntos de chequeo para la ruta seleccionada:
- Número de orden
- Nombre del punto
- Descripción
- Coordenadas

### Pestaña: Registros

Historial de ejecución de patrullas:
- Nombre de la ruta
- Guardia asignado
- Estado: completada / en progreso / incompleta
- Checkpoints visitados
- Hora de inicio y finalización

---

## 14. Turnos y Guardias

### Gestión de Turnos

Definir turnos de trabajo:
- Nombre del turno (ej: "Turno Día", "Turno Noche")
- Horario de inicio y fin
- Días de la semana
- Sitios cubiertos

### Asignaciones

Asignar operadores a turnos:
- Seleccionar turno
- Asignar uno o más operadores
- Ver cobertura por día de la semana

---

## 15. SLA

### Definiciones

Configurar tiempos máximos de respuesta y resolución por severidad:

| Severidad | Respuesta | Resolución |
|-----------|-----------|------------|
| Crítico | 5 min | 30 min |
| Alto | 15 min | 2 horas |
| Medio | 30 min | 8 horas |
| Bajo | 2 horas | 24 horas |

### Seguimiento

- Incidentes que están dentro del SLA (verde)
- Incidentes próximos a vencer (amarillo)
- Incidentes que violaron el SLA (rojo)
- Estadísticas de cumplimiento

---

## 16. Emergencias

### Protocolos

Definir protocolos de emergencia:
- Nombre (ej: "Incendio", "Intrusión", "Emergencia Médica")
- Descripción y pasos a seguir
- Contactos de emergencia asociados
- Procedimiento de activación

### Contactos

Lista de contactos de emergencia:
- Policía, bomberos, ambulancia
- Gerencia y supervisores
- Servicios técnicos

### Activaciones

Historial de activaciones de protocolos:
- Cuándo se activó
- Quién lo activó
- Estado de resolución
- Tiempo de respuesta

---

## 17. Reportes

### Reportes Disponibles

| Reporte | Contenido |
|---------|-----------|
| Resumen de Eventos | Eventos por tipo, severidad, período |
| Reporte de Incidentes | Incidentes abiertos y resueltos |
| Salud de Dispositivos | Estado online/offline e inventario |
| Uso de IA | Sesiones y tokens consumidos |

### Generar Reporte

1. Seleccionar tipo de reporte
2. Definir período (desde — hasta)
3. Aplicar filtros opcionales
4. Clic en **Generar**
5. Descargar en PDF o CSV

### Resumen Rápido

En la parte superior muestra KPIs del período:
- Total de eventos
- Eventos críticos
- Resueltos
- Dispositivos online

### Gráficas

- Eventos por severidad (barras)
- Tendencia de eventos (línea, 7 días)
- Incidentes por estado (pie chart)
- Dispositivos por estado (barras)

---

## 18. WhatsApp

### Conversaciones

Lista de conversaciones de WhatsApp:
- Nombre del contacto
- Último mensaje
- Estado de la conversación
- Acciones: responder, escalar, cerrar

### Plantillas

Plantillas aprobadas por Meta:
- Nombre y categoría
- Estado (aprobada/pendiente)
- Botón de sincronizar con Meta

### Configuración

Desde esta pestaña se configuran las credenciales de WhatsApp Business.

---

## 19. Asistente IA

### Chat

Interfaz de chat con el asistente inteligente:
1. Escribir pregunta o comando en el campo inferior
2. Presionar Enter o clic en Enviar
3. El asistente responde con información del sistema

### Acciones Rápidas

Botones predefinidos para consultas frecuentes:
- **Resumir alertas**: Resume todas las alertas activas y sugiere acciones
- **Estado de dispositivos**: Muestra dispositivos que necesitan atención
- **Borrador de reporte**: Genera borrador de reporte de incidente
- **Generar SOP**: Crea procedimiento operativo estándar

### Limpiar Chat

Clic en **Limpiar chat** para iniciar una nueva conversación.

---

## 20. Reproducción (Playback)

### Acceder

Desde **Reproducción** en la barra lateral.

### Funciones

- Seleccionar cámara y rango de fecha/hora
- Línea de tiempo con marcadores de eventos
- Controles de reproducción: play, pause, velocidad
- Captura de frames
- Descarga de clips (cuando disponible vía NVR)

---

## 21. Base de Datos

### Registros por Sección

Vista de datos operativos organizados por sección:
- Residentes, comercios, proveedores, empresas
- Búsqueda por nombre, unidad, teléfono
- Filtro por sección

### Agregar Registro

1. Clic en **Agregar Registro**
2. Llenar nombre, sección, unidad, teléfono, observaciones
3. Agregar vehículos asociados
4. Guardar

### Acciones

- Editar registro existente
- Eliminar registro
- Ver vehículos asociados
- Ver observaciones

---

## 22. Reinicios

### Vista de Reinicios

Gestión de reinicios operativos de dispositivos:

**KPIs:**
- Dispositivos con problemas
- Exitosos hoy
- Pendientes
- Recuperación promedio

### Dispositivos con Problemas

Lista de dispositivos que necesitan reinicio:
- Nombre y motivo
- Botón **Reiniciar**

### Historial

Registro de reinicios ejecutados:
- Dispositivo, motivo, resultado
- Tiempo de recuperación
- Quién lo inició

### Asistente IA

Botones de ayuda inteligente:
- Diagnosticar dispositivo
- Sugerir acción
- Generar reporte

---

## 23. Automatización

### Reglas

Lista de reglas de automatización:
- Nombre con tipo de trigger (event/schedule/manual)
- Conteo de acciones
- Badge de prioridad
- Toggle activo/inactivo
- Estadísticas de ejecución

### Historial de Ejecuciones

Registros de cada vez que una regla se ejecutó:
- Nombre de la regla
- Estado: éxito (verde), parcial (amarillo), fallido (rojo)
- Tiempo de ejecución
- Fecha y hora

---

## 24. Búsqueda Global

### Acceder

- Clic en la barra de búsqueda superior
- O presionar **Ctrl+K** (Cmd+K en Mac)

### Buscar

Escribir cualquier término para buscar en:
- Dispositivos
- Eventos
- Sitios
- Personas
- Incidentes

---

## 25. Notificaciones

### Campana de Notificaciones

En la esquina superior derecha, la campana muestra:
- Punto rojo: hay notificaciones sin leer
- Clic lleva a la pantalla de eventos

### Push del Navegador

Si están habilitadas, recibirás alertas incluso con la pestaña minimizada:
- Eventos críticos
- Dispositivos offline
- Alertas de alta severidad

---

## 26. Cambio de Idioma

### Cambiar Idioma

1. En la barra superior, clic en el botón de idioma (ES/EN)
2. Seleccionar:
   - Español
   - English
3. El cambio es inmediato

---

## 27. Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| Ctrl+K / Cmd+K | Búsqueda global |

---

## Glosario

| Término | Definición |
|---------|------------|
| **Tenant** | Empresa/organización en el sistema |
| **Sitio** | Ubicación física monitoreada |
| **Sección** | Subdivisión de un sitio (torre, bloque, zona) |
| **Evento** | Detección automática del sistema (movimiento, alarma, offline) |
| **Incidente** | Investigación que agrupa eventos y requiere seguimiento |
| **Alerta** | Notificación generada por una regla de alerta |
| **SLA** | Acuerdo de nivel de servicio (tiempo máximo de respuesta) |
| **PTZ** | Pan-Tilt-Zoom (control de movimiento de cámara) |
| **NVR** | Grabador de Video en Red |
| **RTSP** | Protocolo de streaming de video |
| **WebRTC** | Protocolo de comunicación en tiempo real (baja latencia) |
| **HLS** | Protocolo de streaming adaptativo (alta compatibilidad) |
| **PBX** | Central telefónica |
| **SIP** | Protocolo de telefonía IP |
| **LPR** | Reconocimiento de Placas Vehiculares |
| **VAPID** | Estándar para notificaciones push web |
| **PWA** | Aplicación Web Progresiva (instalable en móvil) |

---

*Manual de Usuario — Clave Seguridad v1.0 — Marzo 2026*
