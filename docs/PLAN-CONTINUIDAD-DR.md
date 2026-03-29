# Plan de Continuidad de Negocio y Recuperacion ante Desastres

**Version:** 1.0
**Fecha:** 2026-03-29
**Clasificacion:** CONFIDENCIAL — Uso interno
**Responsable:** CTO / DevOps
**Proxima revision:** Semestral

---

## 1. Objetivo

Garantizar la continuidad del servicio de monitoreo de seguridad y la recuperacion de la plataforma AION ante eventos disruptivos, minimizando el impacto en las operaciones de las 22 sedes monitoreadas por Clave Seguridad CTA.

## 2. Objetivos de Recuperacion

| Metrica | Objetivo | Justificacion |
|---------|----------|---------------|
| RTO (Recovery Time Objective) | 4 horas | Servicio de seguridad requiere alta disponibilidad |
| RPO (Recovery Point Objective) | 1 hora | Backups automaticos cada hora |
| MTTR (Mean Time to Repair) | 2 horas | Para incidentes de severidad alta |

## 3. Inventario de Activos Criticos

| Activo | Ubicacion | Criticidad | Alternativa |
|--------|-----------|------------|-------------|
| VPS Principal | AWS Sao Paulo (18.230.40.6) | CRITICA | Snapshot + nueva instancia |
| PostgreSQL (aionseg_prod) | VPS local :5432 | CRITICA | Backup + restauracion |
| PostgreSQL (aion_prod) | VPS local :5432 | CRITICA | Backup + restauracion |
| Redis | VPS local :6379 | ALTA | Reconstruible (cache) |
| API Backend (PM2) | VPS :3000/:3001 | CRITICA | Redeploy desde GitHub |
| Frontend (Nginx) | VPS :80/:443 | ALTA | Rebuild + deploy |
| go2rtc (43 streams) | VPS :1984 | ALTA | Restart + auto-config |
| Asterisk PBX | VPS :5061 | MEDIA | Restart con config backup |
| Mosquitto MQTT | VPS :1883 | MEDIA | Restart |

## 4. Escenarios de Desastre

### 4.1 Fallo del VPS

**Causa:** Fallo de hardware AWS, error de configuracion, compromiso de seguridad.

**Procedimiento:**
1. Detectar via monitoreo externo (uptime check cada 1 min)
2. Lanzar nueva instancia EC2 desde AMI/snapshot mas reciente
3. Asignar IP elastica o actualizar DNS
4. Restaurar base de datos desde backup
5. Iniciar servicios con PM2
6. Verificar conectividad de camaras y dispositivos

**RTO estimado:** 2-4 horas

### 4.2 Corrupcion de Base de Datos

**Causa:** Fallo de disco, error de migracion, error humano.

**Procedimiento:**
1. Detener API backend inmediatamente
2. Evaluar extension de la corrupcion
3. Si parcial: reparar con `pg_dump` + restauracion selectiva
4. Si total: restaurar desde ultimo backup valido
5. Verificar integridad con checksums
6. Reiniciar servicios

**RTO estimado:** 1-2 horas

### 4.3 Compromiso de Seguridad

**Causa:** Acceso no autorizado, ransomware, exfiltracion.

**Procedimiento:**
1. Activar Plan de Respuesta a Incidentes
2. Aislar servidor (cerrar security groups)
3. Evaluar alcance del compromiso
4. Si los datos estan intactos: parchear y restaurar acceso
5. Si los datos estan comprometidos: restaurar desde backup limpio
6. Rotar TODAS las credenciales

**RTO estimado:** 4-8 horas

### 4.4 Fallo de Conectividad de Sedes

**Causa:** Corte de internet en sede, fallo de router.

**Impacto:** Solo la sede afectada pierde monitoreo remoto. DVR/NVR local sigue grabando.

**Procedimiento:**
1. Alerta automatica por dispositivo offline
2. Contactar al encargado de la sede
3. Verificar estado de router e ISP
4. Si el problema persiste: despachar tecnico

**RTO estimado:** Depende del ISP de la sede

## 5. Estrategia de Backups

### 5.1 Backups de Base de Datos

| Tipo | Frecuencia | Retencion | Ubicacion |
|------|-----------|-----------|-----------|
| pg_dump completo | Diario (3:00 AM) | 30 dias | /var/backups/postgresql/ en VPS |
| pg_dump incremental | Cada hora | 48 horas | VPS local |
| Snapshot de disco EBS | Semanal | 4 semanas | AWS S3 (pendiente configurar) |

### 5.2 Backups de Configuracion

| Recurso | Metodo | Frecuencia |
|---------|--------|-----------|
| Nginx configs | git en /etc/nginx/ | En cada cambio |
| PM2 ecosystem | pm2 save | En cada cambio |
| Asterisk configs | Copia en /var/backups/ | Semanal |
| go2rtc config | Versionado en repo | En cada cambio |
| .env files | Copia cifrada | En cada cambio |

### 5.3 Backups de Codigo

| Recurso | Ubicacion | Automatico |
|---------|-----------|-----------|
| Codigo fuente | GitHub (aion-platform, aionseg-platform) | Si (push) |
| Frontend build | GitHub + VPS /var/www/ | Si (deploy) |
| Backend build | GitHub + VPS dist/ | Si (deploy) |

## 6. Procedimiento de Restauracion

### 6.1 Restauracion de Base de Datos

```bash
# 1. Detener API
pm2 stop aionseg-api aion-api

# 2. Restaurar desde backup
pg_restore -U aionseg -d aionseg_prod /var/backups/postgresql/aionseg_prod_YYYYMMDD.dump

# 3. Verificar integridad
psql -U aionseg -d aionseg_prod -c "SELECT count(*) FROM sites;"
psql -U aionseg -d aionseg_prod -c "SELECT count(*) FROM devices;"

# 4. Reiniciar API
pm2 restart aionseg-api aion-api
```

### 6.2 Restauracion Completa del Servidor

```bash
# 1. Lanzar nueva instancia EC2 (Ubuntu 22.04, t3.xlarge)
# 2. Instalar dependencias
apt update && apt install -y postgresql-16 redis nginx nodejs npm
npm install -g pm2 pnpm

# 3. Clonar repositorios
git clone https://github.com/jlort1721-alt/aion-platform.git /var/www/aion
git clone https://github.com/jlort1721-alt/aionseg-platform.git /var/www/aionseg

# 4. Restaurar base de datos desde backup externo
# 5. Configurar .env files
# 6. Build y deploy
cd /var/www/aionseg/backend && pnpm install && npx turbo build
pm2 start ecosystem.config.js

# 7. Restaurar Nginx config
# 8. Certificados SSL (Cloudflare maneja SSL externo)
# 9. Verificar todos los servicios
```

## 7. Pruebas del Plan

| Tipo de prueba | Frecuencia | Responsable |
|----------------|-----------|-------------|
| Restauracion de backup DB | Mensual | DevOps |
| Simulacro de fallo de VPS | Semestral | CTO + DevOps |
| Verificacion de backups | Semanal (automatico) | Cron job |
| Revision del plan | Semestral | CTO |

## 8. Comunicacion en Crisis

| Audiencia | Canal | Responsable | Tiempo |
|-----------|-------|-------------|--------|
| Equipo tecnico | Grupo WhatsApp interno | CTO | Inmediato |
| Operadores de turno | Llamada directa | Lider de Operaciones | < 15 min |
| Clientes (sedes) | Email + WhatsApp | Gerencia | < 1 hora |
| Autoridades (si aplica) | Oficio formal | Legal | Segun regulacion |

## 9. Contactos de Emergencia

| Servicio | Contacto |
|----------|----------|
| AWS Support | Consola AWS / caso de soporte |
| ISP VPS (AWS) | support.aws.amazon.com |
| Cloudflare | dash.cloudflare.com |
| PostgreSQL emergencia | [DBA CONTACTO] |
| Equipo desarrollo | [GRUPO WHATSAPP] |
