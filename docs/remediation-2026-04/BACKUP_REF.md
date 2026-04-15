# BACKUP REFERENCE

**Timestamp:** `20260415-205328` (2026-04-15 20:53:28 UTC)
**Location:** `/var/backups/aion/20260415-205328/` en VPS 18.230.40.6
**Tag git de seguridad:** `pre-remediation-20260415-155113`

## Archivos y tamaños verificados

| Archivo | Tamaño | SHA |
|---|---|---|
| postgres-full.sql.gz | 5.6M | (dumpall de todos los clusters) |
| aionseg_prod.dump | 6.2M | (pg_dump -Fc custom format) |
| var-www-aionseg.tar.gz | 160M | (app en producción) |
| opt-aion.tar.gz | 250M | (vision-hub, observability, ops, scripts) |
| etc-nginx.tar.gz | 11K | (config reverse proxy) |
| etc-asterisk.tar.gz | 198K | (config PBX) |
| pm2-dump.pm2 | 86K | (snapshot 26 servicios) |

## Restaurar

```bash
# Restaurar BD
gunzip < /var/backups/aion/20260415-205328/postgres-full.sql.gz | sudo -u postgres psql
# ó sólo aionseg_prod
sudo -u postgres pg_restore -d aionseg_prod -c /var/backups/aion/20260415-205328/aionseg_prod.dump

# Restaurar código
sudo tar -xzf /var/backups/aion/20260415-205328/var-www-aionseg.tar.gz -C /var/www/

# Restaurar PM2
cp /var/backups/aion/20260415-205328/pm2-dump.pm2 /home/ubuntu/.pm2/dump.pm2
pm2 resurrect
```
