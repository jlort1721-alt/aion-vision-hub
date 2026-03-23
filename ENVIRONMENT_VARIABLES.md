# Clave Seguridad — Variables de Entorno

## Frontend (`.env`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `VITE_API_URL` | Sí | URL del backend API (ej: `http://localhost:3000`) |
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sí | Clave pública (anon key) de Supabase |
| `VITE_SIP_SERVER` | No | Servidor SIP para VoIP |
| `VITE_SIP_PORT` | No | Puerto WebSocket SIP (default: 8089) |
| `VITE_SIP_TRANSPORT` | No | Transporte SIP (default: wss) |

## Backend (`backend/.env`)

### Obligatorias

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URI PostgreSQL completa |
| `JWT_SECRET` | Secreto JWT, mínimo 32 caracteres |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma |

### Opcionales

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `development` o `production` |
| `PORT` | Puerto del servidor (default: 3000) |
| `LOG_LEVEL` | Nivel de log: debug, info, warn, error |
| `RATE_LIMIT_MAX` | Máximo de requests por ventana |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit en ms |
| `MEDIAMTX_API_URL` | URL API de MediaMTX |
| `DISCOVERY_NETWORK_RANGE` | Rango de red para descubrimiento de dispositivos |
| `OPENAI_API_KEY` | Clave API de OpenAI |
| `ANTHROPIC_API_KEY` | Clave API de Anthropic |
| `RESEND_API_KEY` | Clave API de Resend (email) |
| `SMTP_HOST` | Host SMTP |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp Business |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso WhatsApp Cloud API |
| `CREDENTIAL_ENCRYPTION_KEY` | Clave de encriptación para credenciales de dispositivos (32 chars) |
| `EWELINK_APP_ID` | App ID de eWeLink |
| `EWELINK_APP_SECRET` | App Secret de eWeLink |

## Docker (`.env.docker`)

| Variable | Descripción |
|----------|-------------|
| `DB_USER` | Usuario PostgreSQL (default: clave) |
| `DB_PASSWORD` | Contraseña PostgreSQL |
| `DB_NAME` | Nombre de la base de datos (default: clave_db) |
| `DB_PORT` | Puerto PostgreSQL (default: 5432) |
| `JWT_SECRET` | Secreto JWT |
| `FRONTEND_PORT` | Puerto del frontend (default: 8080) |
| `BACKEND_PORT` | Puerto del backend (default: 3000) |
| `CORS_ORIGINS` | Orígenes CORS permitidos |

## Generación de Secretos

```bash
# JWT Secret
openssl rand -base64 48

# Encryption Key (32 chars)
openssl rand -hex 16
```
