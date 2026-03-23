# Clave Seguridad — Manual de Despliegue y Operaciones

> Guía para DevOps / Administrador de infraestructura
> Versión 1.0 — Marzo 2026

---

## Tabla de Contenidos

1. [Arquitectura de Despliegue](#1-arquitectura-de-despliegue)
2. [Requisitos de Servidor](#2-requisitos-de-servidor)
3. [Despliegue con Docker Compose](#3-despliegue-con-docker-compose)
4. [Configuración de Dominio y DNS](#4-configuración-de-dominio-y-dns)
5. [SSL/TLS con Let's Encrypt](#5-ssltls-con-lets-encrypt)
6. [NGINX como Reverse Proxy](#6-nginx-como-reverse-proxy)
7. [Gestión de Secretos](#7-gestión-de-secretos)
8. [Base de Datos PostgreSQL](#8-base-de-datos-postgresql)
9. [Migraciones](#9-migraciones)
10. [Backups y Restauración](#10-backups-y-restauración)
11. [Monitoreo y Health Checks](#11-monitoreo-y-health-checks)
12. [Logs y Debugging](#12-logs-y-debugging)
13. [Escalamiento](#13-escalamiento)
14. [CI/CD con GitHub Actions](#14-cicd-con-github-actions)
15. [Actualización de la Plataforma](#15-actualización-de-la-plataforma)
16. [Rollback](#16-rollback)
17. [Seguridad del Servidor](#17-seguridad-del-servidor)
18. [Firewall y Puertos](#18-firewall-y-puertos)
19. [Windows 11 — Instalación Local](#19-windows-11--instalación-local)
20. [Acceso desde Teléfono (LAN/WAN)](#20-acceso-desde-teléfono-lanwan)
21. [PWA — Instalación como App](#21-pwa--instalación-como-app)
22. [Procedimientos de Emergencia](#22-procedimientos-de-emergencia)
23. [Checklist de Go-Live](#23-checklist-de-go-live)

---

## 1. Arquitectura de Despliegue

### Producción (Docker Compose)

```
Internet
  │
  ▼
[NGINX + SSL] :443
  │
  ├── /          → clave-frontend  :80  (SPA React)
  ├── /api/*     → clave-backend   :3000 (Fastify API)
  └── /ws        → clave-backend   :3000 (WebSocket)

[clave-postgres]  :5432  (PostgreSQL + pgvector)
[clave-mediamtx]  :8554  (RTSP)
                  :8888  (HLS)
                  :8889  (WebRTC)
```

### Servicios Docker

| Servicio | Imagen | Puertos | Volúmenes |
|----------|--------|---------|-----------|
| clave-frontend | Build local (Node→NGINX) | 8080:80 | — |
| clave-backend | Build local (Node 20) | 3000:3000 | — |
| clave-postgres | ankane/pgvector:latest | 5432:5432 | clave_pgdata |
| clave-mediamtx | bluenviron/mediamtx:latest-ffmpeg | 8554,8888,8889 | — |

---

## 2. Requisitos de Servidor

### Mínimos

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disco | 50 GB SSD | 200+ GB SSD |
| Red | 50 Mbps | 100+ Mbps simétrico |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |

### Software Requerido

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose (incluido en Docker Engine moderno)
docker compose version

# Git
sudo apt install git -y

# Certbot (para SSL)
sudo apt install certbot -y
```

---

## 3. Despliegue con Docker Compose

### Paso 1: Clonar repositorio

```bash
git clone <REPO_URL> /opt/clave-seguridad
cd /opt/clave-seguridad
```

### Paso 2: Configurar variables

```bash
cp .env.docker.example .env.docker
```

Editar `.env.docker`:

```env
DB_USER=clave
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME=clave_db
JWT_SECRET=$(openssl rand -base64 48)
CORS_ORIGINS=https://tu-dominio.com
FRONTEND_PORT=8080
BACKEND_PORT=3000
```

Configurar backend:

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` con los valores de producción (DATABASE_URL, JWT_SECRET, etc.).

### Paso 3: Build y levantar

```bash
docker compose --env-file .env.docker up -d --build
```

### Paso 4: Verificar

```bash
# Estado de contenedores
docker compose ps

# Logs en tiempo real
docker compose logs -f

# Health check
curl http://localhost:3000/health
```

---

## 4. Configuración de Dominio y DNS

### Registro DNS

En tu proveedor DNS (Cloudflare, Route53, GoDaddy, etc.):

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | tu-dominio.com | IP_DEL_SERVIDOR | 300 |
| A | www.tu-dominio.com | IP_DEL_SERVIDOR | 300 |

### Verificar Propagación

```bash
dig +short tu-dominio.com
# Debe mostrar la IP del servidor

nslookup tu-dominio.com
```

---

## 5. SSL/TLS con Let's Encrypt

### Obtener Certificado

```bash
# Detener NGINX temporal si está en puerto 80
sudo certbot certonly --standalone \
  -d tu-dominio.com \
  -d www.tu-dominio.com \
  -m admin@tu-dominio.com \
  --agree-tos
```

### Renovación Automática

```bash
# Verificar que el timer de renovación está activo
sudo systemctl status certbot.timer

# O agregar cron manual
echo "0 3 * * * certbot renew --quiet && systemctl reload nginx" | sudo crontab -
```

### Ubicación de Certificados

```
/etc/letsencrypt/live/tu-dominio.com/fullchain.pem
/etc/letsencrypt/live/tu-dominio.com/privkey.pem
```

---

## 6. NGINX como Reverse Proxy

### Instalar NGINX

```bash
sudo apt install nginx -y
```

### Configuración de Producción

```bash
sudo nano /etc/nginx/sites-available/clave-seguridad
```

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (SPA)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts para uploads/reportes grandes
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    # Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    # Health check (no auth)
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }

    # MediaMTX HLS streams
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
    }

    # MediaMTX WebRTC
    location /webrtc/ {
        proxy_pass http://127.0.0.1:8889/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Deny access to dot files
    location ~ /\. {
        deny all;
    }
}
```

### Activar y Recargar

```bash
sudo ln -s /etc/nginx/sites-available/clave-seguridad /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Gestión de Secretos

### Principios

- Nunca commitear secretos al repositorio
- Usar `.env` files con permisos restrictivos
- Rotar secretos periódicamente

### Permisos de Archivos

```bash
chmod 600 .env.docker
chmod 600 backend/.env
chown root:root .env.docker backend/.env
```

### Secretos Críticos

| Secreto | Cómo Generar | Rotación |
|---------|-------------|----------|
| JWT_SECRET | `openssl rand -base64 48` | Cada 90 días |
| DB_PASSWORD | `openssl rand -base64 32` | Cada 180 días |
| CREDENTIAL_ENCRYPTION_KEY | `openssl rand -hex 16` | Solo si comprometida |
| WHATSAPP_APP_SECRET | Desde Meta Business | Según Meta |

### Rotación de JWT_SECRET

1. Generar nuevo secreto
2. Actualizar en `.env`
3. Reiniciar backend: `docker compose restart clave-backend`
4. Todos los usuarios serán deslogueados (refresh tokens invalidados)

---

## 8. Base de Datos PostgreSQL

### Conexión Directa

```bash
# Desde el host
docker exec -it clave-postgres psql -U clave clave_db

# Desde fuera (si puerto expuesto)
psql postgres://clave:PASSWORD@localhost:5432/clave_db
```

### Comandos Útiles

```sql
-- Ver tablas
\dt

-- Ver tamaño de tablas
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Ver conexiones activas
SELECT count(*) FROM pg_stat_activity;

-- Ver queries lentos
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds';
```

### Tuning Básico

Para servidores con 8GB+ RAM, ajustar en docker-compose o postgresql.conf:

```
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB
```

---

## 9. Migraciones

### Ubicación

```
backend/apps/backend-api/src/db/migrations/
├── 001_initial.sql
├── 002_monitoring.sql
├── ...
└── 013_streams_tenant_id.sql
```

### Aplicar Migraciones

```bash
# Dentro del contenedor backend
docker exec -it clave-backend sh
cd /usr/src/app/apps/backend-api
npx drizzle-kit migrate

# O directamente
docker exec clave-backend npx drizzle-kit migrate
```

### Crear Nueva Migración

```bash
cd backend
pnpm --filter @aion/backend-api db:generate
```

---

## 10. Backups y Restauración

### Backup Completo

```bash
# Script de backup
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups/clave
mkdir -p $BACKUP_DIR

docker exec clave-postgres pg_dump -U clave -Fc clave_db > $BACKUP_DIR/clave_$TIMESTAMP.dump

# Retener solo últimos 30 días
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

echo "Backup completado: clave_$TIMESTAMP.dump"
```

### Cron para Backup Diario

```bash
echo "0 2 * * * /opt/clave-seguridad/scripts/backup.sh >> /var/log/clave-backup.log 2>&1" | crontab -
```

### Restauración

```bash
# Restaurar desde dump custom format
docker exec -i clave-postgres pg_restore -U clave -d clave_db --clean < backup_file.dump

# Restaurar desde SQL plano
cat backup_file.sql | docker exec -i clave-postgres psql -U clave clave_db
```

### Verificar Backup

```bash
# Verificar integridad del dump
docker exec -i clave-postgres pg_restore -l < backup_file.dump | head -20
```

---

## 11. Monitoreo y Health Checks

### Health Endpoint

```bash
# Básico
curl -s http://localhost:3000/health | jq .

# Respuesta esperada
{
  "status": "healthy",
  "uptime": 86400,
  "checks": [
    {"component": "database", "status": "healthy", "latency_ms": 3},
    {"component": "redis", "status": "healthy", "latency_ms": 1},
    {"component": "mediamtx", "status": "healthy"}
  ]
}
```

### Monitoreo con Docker

```bash
# Estado de contenedores
docker compose ps

# Uso de recursos
docker stats --no-stream

# Espacio en disco
docker system df
```

### Script de Monitoreo

```bash
#!/bin/bash
# Verificar cada servicio
check() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $1)
  if [ "$STATUS" != "200" ]; then
    echo "ALERTA: $2 retornó HTTP $STATUS"
    # Aquí enviar notificación
  fi
}

check "http://localhost:3000/health" "Backend API"
check "http://localhost:8080" "Frontend"
check "http://localhost:9997/v3/paths/list" "MediaMTX"
```

### Prometheus Metrics

Si `PROMETHEUS_ENABLED=true`:

```bash
curl http://localhost:3000/metrics
```

Métricas disponibles:
- `http_request_duration_seconds` — histograma de latencia
- `http_requests_total` — conteo por método/ruta/status
- `nodejs_heap_size_used_bytes` — uso de memoria
- `process_cpu_user_seconds_total` — CPU

---

## 12. Logs y Debugging

### Ver Logs

```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f clave-backend

# Solo PostgreSQL
docker compose logs -f clave-postgres

# Últimas 100 líneas
docker compose logs --tail=100 clave-backend
```

### Nivel de Log

En `backend/.env`:
```env
LOG_LEVEL=debug    # debug, info, warn, error
```

### Formato de Log (Pino)

Los logs usan Pino en formato JSON. Para lectura humana:

```bash
docker compose logs clave-backend | npx pino-pretty
```

### Debugging Común

```bash
# Verificar conectividad a PostgreSQL
docker exec clave-backend node -e "
const pg = require('postgres');
const sql = pg(process.env.DATABASE_URL);
sql\`SELECT 1\`.then(() => console.log('DB OK')).catch(e => console.error('DB FAIL', e.message));
"

# Verificar DNS interno Docker
docker exec clave-backend ping clave-postgres

# Ver variables de entorno del contenedor
docker exec clave-backend env | sort
```

---

## 13. Escalamiento

### Vertical (Más recursos)

Aumentar CPU/RAM del servidor y ajustar PostgreSQL:

```bash
# Verificar carga actual
htop
docker stats
```

### Horizontal (Múltiples instancias)

El backend es stateless (excepto WebSocket). Para escalar:

1. Poner un load balancer frente a múltiples instancias backend
2. Usar Redis para sesiones compartidas y pub/sub
3. Sticky sessions para WebSocket (o Redis adapter)

---

## 14. CI/CD con GitHub Actions

### Pipeline Existente

`.github/workflows/ci.yml`:
- Triggers: push a main/develop, PRs
- Steps: install → build frontend → test backend → type check

### Deploy Production

`.github/workflows/deploy-production.yml`:
- Trigger: tags `v*` o manual
- Steps: build → push Docker images → deploy al servidor

### Configurar GitHub Secrets

| Secret | Valor |
|--------|-------|
| `DEPLOY_HOST` | IP del servidor |
| `DEPLOY_USER` | Usuario SSH |
| `DEPLOY_KEY` | Clave SSH privada |
| `GHCR_TOKEN` | Token para GitHub Container Registry |

---

## 15. Actualización de la Plataforma

### Procedimiento

```bash
cd /opt/clave-seguridad

# 1. Backup antes de actualizar
./scripts/backup.sh

# 2. Pull cambios
git pull origin main

# 3. Rebuild y restart
docker compose --env-file .env.docker up -d --build

# 4. Verificar
docker compose ps
curl http://localhost:3000/health

# 5. Aplicar migraciones si necesario
docker exec clave-backend npx drizzle-kit migrate
```

### Zero-Downtime (Avanzado)

1. Build nuevas imágenes sin detener las actuales
2. Scale up con nuevas imágenes
3. Health check de nuevas instancias
4. Scale down instancias antiguas

---

## 16. Rollback

### Rollback Rápido

```bash
# Volver al commit anterior
git checkout HEAD~1

# Rebuild
docker compose --env-file .env.docker up -d --build
```

### Rollback de Base de Datos

```bash
# Restaurar backup pre-actualización
cat backup_pre_update.sql | docker exec -i clave-postgres psql -U clave clave_db
```

---

## 17. Seguridad del Servidor

### SSH Hardening

```bash
# Deshabilitar login con contraseña
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Cambiar puerto SSH (opcional)
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
```

### Actualizaciones de Seguridad

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install unattended-upgrades -y
```

### Docker Security

- No exponer puertos innecesarios al exterior
- No correr contenedores como root cuando posible
- Limitar recursos por contenedor
- Mantener imágenes actualizadas

---

## 18. Firewall y Puertos

### Puertos Requeridos

| Puerto | Servicio | Acceso |
|--------|----------|--------|
| 22 (o custom) | SSH | Solo admin IPs |
| 80 | HTTP (redirect a HTTPS) | Público |
| 443 | HTTPS | Público |
| 3000 | Backend API | Solo interno (via NGINX) |
| 5432 | PostgreSQL | Solo interno |
| 8080 | Frontend | Solo interno (via NGINX) |
| 8554 | RTSP | Solo red interna de cámaras |
| 8888 | HLS | Via NGINX si necesario |
| 8889 | WebRTC | Via NGINX si necesario |

### UFW (Ubuntu)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### No exponer al exterior

- Puerto 5432 (PostgreSQL): solo acceso local
- Puerto 3000 (Backend): solo via NGINX
- Puerto 8080 (Frontend): solo via NGINX

---

## 19. Windows 11 — Instalación Local

### Requisitos

1. Windows 11 con WSL2 habilitado
2. Docker Desktop instalado y corriendo
3. Git para Windows

### Pasos

```powershell
# 1. Clonar
git clone <REPO_URL> C:\clave-seguridad
cd C:\clave-seguridad

# 2. Configurar
copy .env.docker.example .env.docker
copy backend\.env.example backend\.env
# Editar con notepad o VS Code

# 3. Levantar
docker compose --env-file .env.docker up -d --build

# 4. Verificar
docker compose ps
# Abrir http://localhost:8080
```

### Firewall Windows (para acceso LAN)

```powershell
# Ejecutar como Administrador
netsh advfirewall firewall add rule name="Clave Seguridad" dir=in action=allow protocol=tcp localport=8080
```

### Acceso desde teléfono en LAN

```powershell
# Obtener IP local
ipconfig | findstr "IPv4"
# Resultado: 192.168.1.X
# Abrir en teléfono: http://192.168.1.X:8080
```

---

## 20. Acceso desde Teléfono (LAN/WAN)

### Modo LAN (Red Local)

1. Obtener IP del servidor en la red local
2. Abrir `http://IP:8080` en el navegador del teléfono
3. Funciona sin internet, solo WiFi

### Modo WAN (Internet/Dominio)

1. Configurar dominio y SSL (ver secciones 4-6)
2. Abrir `https://tu-dominio.com` en el teléfono
3. Funciona desde cualquier lugar con internet

---

## 21. PWA — Instalación como App

### Android (Chrome)

1. Abrir la URL de Clave Seguridad en Chrome
2. Esperar banner de instalación, o menú (⋮) → "Instalar aplicación"
3. Confirmar instalación
4. La app aparece como ícono en el escritorio

### iOS (Safari)

1. Abrir la URL en Safari
2. Tocar botón compartir (↑)
3. Seleccionar "Agregar a pantalla de inicio"
4. Confirmar nombre
5. El ícono aparece en el escritorio

### Características PWA

- Pantalla completa (sin barra del navegador)
- Atajos rápidos: Dashboard, Vista en Vivo, Eventos, Incidentes
- Notificaciones push (Android)
- Caché offline de la interfaz
- Actualización automática en segundo plano

---

## 22. Procedimientos de Emergencia

### El sistema no responde

```bash
# 1. Verificar estado
docker compose ps

# 2. Reiniciar todo
docker compose restart

# 3. Si no levanta, ver logs
docker compose logs --tail=50

# 4. Verificar disco
df -h

# 5. Verificar memoria
free -h
```

### Base de datos corrupta

```bash
# 1. Detener backend
docker compose stop clave-backend

# 2. Restaurar último backup
cat ultimo_backup.sql | docker exec -i clave-postgres psql -U clave clave_db

# 3. Reiniciar backend
docker compose start clave-backend
```

### Servidor comprometido

1. Aislar el servidor (bloquear acceso externo)
2. Cambiar todas las contraseñas y secretos
3. Revisar logs de auditoría
4. Restaurar desde backup limpio
5. Rotar JWT_SECRET, DB_PASSWORD, API keys
6. Notificar a los responsables

### Disco lleno

```bash
# Limpiar imágenes Docker no usadas
docker system prune -a

# Limpiar logs antiguos
docker compose logs --no-log-prefix clave-backend > /dev/null

# Verificar backups antiguos
find /opt/backups -mtime +30 -delete
```

---

## 23. Checklist de Go-Live

### Infraestructura

- [ ] Servidor provisionado con requisitos mínimos
- [ ] Docker y Docker Compose instalados
- [ ] Firewall configurado (solo puertos necesarios)
- [ ] SSH hardening aplicado

### DNS y SSL

- [ ] Dominio apuntando al servidor
- [ ] Certificado SSL obtenido y verificado
- [ ] NGINX configurado con HTTPS
- [ ] Redirect HTTP → HTTPS funcionando

### Aplicación

- [ ] Variables de entorno de producción configuradas
- [ ] `docker compose up -d --build` exitoso
- [ ] Health check retorna healthy
- [ ] Frontend carga correctamente
- [ ] Login funciona

### Seguridad

- [ ] JWT_SECRET es único y largo (48+ chars)
- [ ] DB_PASSWORD es fuerte
- [ ] CREDENTIAL_ENCRYPTION_KEY configurada
- [ ] CORS_ORIGINS apunta solo al dominio de producción
- [ ] Puerto PostgreSQL NO expuesto al exterior
- [ ] `.env` files con permisos 600

### Datos

- [ ] Migraciones aplicadas
- [ ] Usuario admin creado
- [ ] Tenant configurado
- [ ] Al menos un sitio y dispositivo de prueba

### Operaciones

- [ ] Backup automático configurado (cron)
- [ ] Backup manual probado y restauración verificada
- [ ] Monitoreo de health check activo
- [ ] Logs accesibles

### Comunicaciones

- [ ] Email configurado y probado
- [ ] (Opcional) WhatsApp configurado y webhook verificado
- [ ] (Opcional) Push notifications VAPID keys generadas

### Acceso

- [ ] Acceso web desde navegador desktop verificado
- [ ] Acceso desde teléfono verificado
- [ ] PWA instalable verificado
- [ ] WebSocket conecta correctamente

### Documentación

- [ ] Credenciales almacenadas de forma segura
- [ ] Runbook de operaciones entregado
- [ ] Contactos de soporte definidos

---

*Manual de Despliegue y Operaciones — Clave Seguridad v1.0 — Marzo 2026*
