# AION Reverse-Connect Gateway

## Arquitectura

```
Sitios (22+)                    Internet           VPS AION (18.230.40.6)
────────────                    ────────           ──────────────────────
[Hikvision DVR/NVR] ── TCP out ──► :7660 ──► Platform Server (Python)
[Dahua XVR]         ── TCP out ──► :7681 ──►       │
                                                    ▼
                                        registered-devices.json
                                                    │ cron */2 min
                                                    ▼
                                        reverse-sync.py → PostgreSQL (schema reverse)
                                                    │
                                                    ▼
                                        Fastify API /reverse/* (11 endpoints)
                                                    │
                                                    ▼
                                        React /reverse (ReverseFleetPage)
```

## Protocolos

| Marca | Protocolo | Puerto VPS | Configuración en equipo |
|-------|-----------|------------|------------------------|
| Hikvision | ISUP / EHome v5 | TCP 7660 | Red → Avanzado → Acceso a Plataforma |
| Dahua | Auto Register / Platform Access | TCP 7681 | Red → Registro Automático |

## Componentes

### Backend
- **Platform Server** (`/usr/local/bin/device-platform-server.py`) — Recibe conexiones ISUP y Platform Access
- **Reverse Sync** (`/usr/local/bin/reverse-sync.py`) — Sincroniza dispositivos a PostgreSQL cada 2 min
- **API Fastify** (`/reverse/*`) — 11 endpoints REST para gestión de flota

### Frontend
- **ReverseFleetPage** (`/reverse`) — Dashboard con KPIs, tabla de dispositivos, eventos

### Base de datos
- Schema `reverse` con 5 tablas: devices, sessions, streams, events, audit_log

## Endpoints API

| Método | Path | Descripción |
|--------|------|-------------|
| GET | /reverse/health | Estado del gateway |
| GET | /reverse/devices | Lista dispositivos |
| GET | /reverse/devices/:id | Detalle dispositivo |
| POST | /reverse/devices/:id/approve | Aprobar dispositivo |
| POST | /reverse/devices/:id/block | Bloquear dispositivo |
| GET | /reverse/sessions | Sesiones activas |
| GET | /reverse/sessions/:id | Detalle sesión |
| POST | /reverse/sessions/:id/streams | Iniciar stream |
| DELETE | /reverse/sessions/:id/streams/:ch | Detener stream |
| POST | /reverse/sessions/:id/ptz | Control PTZ |
| GET | /reverse/events | Eventos |

## Monitoreo

- PM2: `pm2 logs platform-server`
- Cron sync: `cat /var/log/reverse-sync.log`
- DB: `psql -c "SELECT * FROM reverse.sessions WHERE state='online'"`
- Frontend: https://aionseg.co/reverse

## Rollback

```bash
pm2 stop platform-server
psql -c "DROP SCHEMA reverse CASCADE"
# Restaurar desde backup:
pg_restore -d aionseg_prod /backup/pre-reverse-20260412-0700.dump
```
