# Manual del Operador — AION Reverse-Connect

## ¿Qué es Reverse-Connect?

Es la tecnología que permite que los DVR/NVR de los sitios se conecten directamente al servidor AION sin necesidad de IP pública, port-forwarding, o servicios de nube como IMOU o Hik-Connect.

## Cómo verificar que un sitio está conectado

1. Ir a **aionseg.co/reverse**
2. Ver la tabla de dispositivos
3. Si el estado es **"En línea"** (verde) → el equipo está conectado
4. Si el estado es **"Desconectado"** (gris) → el equipo perdió conexión

## Cómo aprobar un dispositivo nuevo

Cuando un técnico configura un equipo nuevo, aparece como "Pendiente de aprobación" (amarillo):
1. Ir a aionseg.co/reverse
2. Buscar el dispositivo con estado amarillo
3. Click en botón **"Aprobar"**
4. El dispositivo pasará a estado "Aprobado" y comenzará a funcionar

## Cómo bloquear un dispositivo

Si detectas un dispositivo desconocido o no autorizado:
1. Click en el botón rojo de bloqueo (🛡✗)
2. El dispositivo será bloqueado y no podrá conectarse

## Verificar video en vivo

Los dispositivos conectados por Reverse-Connect tienen video en:
- **aionseg.co/live-view** — Vista general de todas las cámaras
- **aionseg.co/wall/1** — Muro de monitoreo

## Verificar sesiones

En aionseg.co/reverse se muestra:
- Dispositivos online / total
- Sesiones activas
- Último heartbeat de cada equipo

## Qué hacer si un sitio se desconecta

1. Verificar que el equipo del sitio tiene internet
2. Verificar que el router del sitio funciona
3. Si el equipo se reinició, esperar 2-3 minutos — se reconecta automáticamente
4. Si no se reconecta después de 5 minutos, contactar al técnico

## Datos del servidor

| Campo | Valor |
|-------|-------|
| VPS | 18.230.40.6 |
| Puerto Hikvision | 7660 |
| Puerto Dahua | 7681 |
| Frontend | aionseg.co/reverse |
| API | aionseg.co/reverse/health |
