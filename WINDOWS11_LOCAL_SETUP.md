# Clave Seguridad — Instalación Local en Windows 11

## Requisitos Previos

1. **Docker Desktop** — [Descargar](https://www.docker.com/products/docker-desktop/)
   - Instalar y reiniciar
   - Habilitar WSL2 cuando se solicite
   - Verificar: abrir PowerShell → `docker --version`

2. **Git** — [Descargar](https://git-scm.com/download/win)

## Instalación (3 pasos)

### Paso 1: Clonar el repositorio
```powershell
git clone <URL_DEL_REPOSITORIO> clave-seguridad
cd clave-seguridad
```

### Paso 2: Configurar variables de entorno
```powershell
# Copiar plantillas
copy .env.docker.example .env.docker
copy backend\.env.example backend\.env
```

Editar `.env.docker` con un editor de texto y configurar:
- `DB_PASSWORD` — contraseña segura para la base de datos
- `JWT_SECRET` — cadena aleatoria de al menos 32 caracteres

### Paso 3: Iniciar los servicios
```powershell
docker compose --env-file .env.docker up -d --build
```

Esperar 2-3 minutos la primera vez. Verificar:
```powershell
docker compose ps
```

## Acceso

| Servicio | URL |
|----------|-----|
| Plataforma | http://localhost:8080 |
| API Backend | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:3000/docs |
| RTSP Gateway | rtsp://localhost:8554 |
| HLS Streams | http://localhost:8888 |
| WebRTC | http://localhost:8889 |

## Acceso desde el Teléfono (misma red WiFi)

1. En PowerShell, obtener la IP local:
   ```powershell
   ipconfig | findstr "IPv4"
   ```
   Ejemplo: `192.168.1.100`

2. **Firewall**: Permitir el puerto 8080:
   ```powershell
   # Ejecutar como Administrador
   netsh advfirewall firewall add rule name="Clave Seguridad" dir=in action=allow protocol=tcp localport=8080
   ```

3. En el teléfono, abrir: `http://192.168.1.100:8080`

## Comandos Útiles

```powershell
# Ver logs en tiempo real
docker compose logs -f

# Reiniciar todo
docker compose restart

# Detener todo
docker compose down

# Detener y borrar datos (cuidado)
docker compose down -v

# Reconstruir después de cambios
docker compose --env-file .env.docker up -d --build
```

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| Puerto 8080 ocupado | Cambiar `FRONTEND_PORT` en `.env.docker` |
| Puerto 5432 ocupado | Cambiar `DB_PORT` en `.env.docker` o detener PostgreSQL local |
| Docker no inicia | Verificar que WSL2 esté habilitado y Docker Desktop ejecutándose |
| Build falla | Ejecutar `docker compose --env-file .env.docker build --no-cache` |
| No se ve desde el teléfono | Verificar regla de firewall y que estén en la misma red WiFi |
