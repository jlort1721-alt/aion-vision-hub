# Clave Seguridad — Acceso desde Teléfono e Instalación PWA

## Modos de Acceso

### 1. Red Local (LAN)
Cuando el teléfono y el servidor están en la misma red WiFi.

**URL:** `http://<IP_DEL_SERVIDOR>:8080`

Para obtener la IP:
- **Windows:** `ipconfig | findstr "IPv4"`
- **Linux:** `hostname -I`

### 2. Dominio Público (Producción)
Cuando el servidor está desplegado con dominio y HTTPS.

**URL:** `https://tu-dominio.com`

## Instalación como App (PWA)

### Android (Chrome)
1. Abrir la URL en Chrome
2. Esperar a que aparezca el banner "Instalar Clave Seguridad" en la parte inferior
3. Si no aparece: tocar el menú (⋮) → "Instalar aplicación" o "Agregar a pantalla de inicio"
4. La app aparecerá como un ícono en el escritorio

### iPhone (Safari)
1. Abrir la URL en Safari
2. Tocar el botón de compartir (↑)
3. Seleccionar "Agregar a pantalla de inicio"
4. Confirmar el nombre "Clave Seguridad"
5. La app aparecerá como un ícono en el escritorio

## Características PWA
- Funciona en pantalla completa (sin barra de navegador)
- Accesos directos: Panel Principal, Vista en Vivo, Eventos, Incidentes
- Notificaciones push para eventos críticos
- Caché offline para la interfaz (datos requieren conexión)
- Actualización automática cuando hay nueva versión

## Funciones Optimizadas para Móvil
- Dashboard responsivo con tarjetas apiladas
- Menú lateral colapsable con botón hamburguesa
- Vista en vivo adaptada a pantalla vertical
- Controles de acceso (abrir puerta/portón) con botones grandes
- Notificaciones push nativas

## Requisitos Mínimos
- **Android:** Chrome 80+ o Edge 80+
- **iOS:** Safari 14+ (iOS 14+)
- **Conexión:** WiFi o datos móviles estables
