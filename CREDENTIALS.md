# AION — Documento de Credenciales
## Generado: 2026-03-29

### ACCESO A LA PLATAFORMA
- URL: https://aionseg.co
- URL alternativa: https://aiosystem.co
- Super Admin: jlort1721@gmail.com / Jml1413031.
- IP VPS: 18.230.40.6

### SERVICIOS VPS
| Servicio | Puerto | Credenciales |
|----------|--------|-------------|
| API aionseg | 3001 | JWT auth |
| API aiosystem | 3000 | JWT auth |
| CLAVE API | 8002 | Internal |
| PostgreSQL | 5432 | aionseg:A10n$3g_Pr0d_2026! / aion_user:A10n_Sys_Pr0d_2026! |
| Redis | 6379 | password: A10n_R3d1s_2026! |
| go2rtc | 1984 | No auth (internal) |
| MQTT | 1883 | No auth yet (localhost only) |
| Asterisk ARI | 8088 | Check /etc/asterisk/ari.conf |
| Nginx | 80/443 | Cloudflare SSL |

### BASES DE DATOS
| DB | Tablas | Registros | Uso |
|----|--------|-----------|-----|
| aionseg_prod | 75 | 7,813 | aionseg.co |
| aion_prod | 228 | 230 | aiosystem.co |

### DISPOSITIVOS HIKVISION
[List all from the inventory with IP:port, user, serial]

### DISPOSITIVOS DAHUA
[List all XVR serials with user/password]

### eWeLink
- Email: clavemonitoreo@gmail.com
- Password: Clave.seg2023
- Pendiente: App ID/Secret de dev.ewelink.cc

### ASTERISK PBX
- 27 extensiones SIP configuradas
- Puerto SIP/TLS: 5061
- Provisioning: https://aionseg.co/provisioning/

### ADMINISTRADORES POR SEDE
[List all from the inventory]

### CONFIGURACION FANVIL
1. Conectar a red local de la sede
2. Acceder a http://[IP_FANVIL] (admin/admin)
3. VoIP → SIP Account → Server=18.230.40.6, Port=5061
4. Activar Auto Answer para intercom
5. O usar auto-provisioning: https://aionseg.co/provisioning/{MAC}.cfg
