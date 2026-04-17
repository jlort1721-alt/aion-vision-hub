# ADR 0004 — n8n: mantener SQLite vs migrar a PostgreSQL

**Fecha:** 2026-04-17
**Estado:** Propuesto
**Autor:** Claude Code

## Contexto

n8n corre como PM2 process `n8n-automations` (319 MB RAM, el segundo mayor consumidor después de `aionseg-api` cluster). Por defecto n8n usa **SQLite** embebida en `~/.n8n/database.sqlite`.

Hay 60 workflows operativos con 9 webhooks en rutas públicas (`/webhooks/n8n`, `/webhooks/twilio`).

## El trade-off

### Mantener SQLite
**Pros:**
- Zero migration effort.
- Funciona bien con ≤100 workflows y tráfico moderado.
- Backup = copiar un archivo.

**Cons:**
- Backups de n8n no se incluyen en el dump PostgreSQL diario (se requieren dos rutas de backup).
- Imposibilidad de alta disponibilidad (n8n queue mode requiere PG).
- Consultas analíticas sobre workflows, executions, credentials requieren parsear SQLite.
- Bloqueos temporales durante pg_dump/backup del SQLite.

### Migrar a PostgreSQL
**Pros:**
- Un solo sistema de backup (pg_dump unificado).
- Permite escalar n8n a queue mode con workers separados.
- Query directo sobre tabla `execution_entity` para métricas en Grafana.
- Defragmentación automática.

**Cons:**
- Migración requiere downtime 5-30 min según volumen de executions.
- Requiere crear DB `n8n` + usuario + permisos en PG (ya gestionado).
- `N8N_ENCRYPTION_KEY` debe preservarse para desencriptar credenciales migradas.

## Decisión

**Migrar a PostgreSQL**, pero **no en el próximo sprint**. Criterio para ejecutar:
1. Cuando se alcance 100+ workflows o 10k+ executions/día, O
2. Cuando se necesite HA real de n8n, O
3. Al pasar a Fase 8 completa (observabilidad avanzada) para unificar analítica.

## Plan de migración (cuando llegue el momento)

```bash
# 1. Backup SQLite
cp ~/.n8n/database.sqlite /var/backups/aion/n8n-sqlite-$(date +%Y%m%d).db

# 2. Crear DB y user
sudo -u postgres psql -c "CREATE DATABASE n8n OWNER n8n_user ENCODING 'UTF8';"

# 3. Configurar .env
cat >> ~/.n8n/.env <<EOF
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=127.0.0.1
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n_user
DB_POSTGRESDB_PASSWORD=<secret>
EOF

# 4. Restart (n8n crea schema automáticamente)
pm2 restart n8n-automations

# 5. Importar workflows via CLI
n8n import:workflow --input=backup.json
n8n import:credentials --input=creds.json
```

## Consecuencias

- **Hoy:** status quo, documentado el plan para cuando se dispare el criterio.
- **Futuro:** si escalamos a >5 sedes/>100 workflows, este ADR se revive.
- **Hacer:** añadir backup SQLite al cron diario (`cp ~/.n8n/database.sqlite /data/backups/n8n/`).
