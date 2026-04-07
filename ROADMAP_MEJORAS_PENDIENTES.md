# AION ��� Roadmap de Mejoras Pendientes

**Fecha:** 2026-04-06
**Score actual:** 98/100
**Estado:** Operativo y funcional

---

## ESTADO VERIFICADO — Todo lo que FUNCIONA

| Sistema | Estado | Detalle |
|---------|--------|---------|
| Backend API | ✅ 200 | 40+ endpoints |
| Frontend | ✅ 54+ rutas | Todas 200 OK |
| Skills | ✅ 26 skills | API funcional |
| MCP Tools | ✅ 83 tools | Registrados |
| AI Chat | ✅ GPT-4o | Con y sin function calling |
| AI Shift Summary | ✅ | Genera con datos reales |
| n8n | ✅ 60/60 | Workflows activos |
| Automation | ✅ 34 reglas | Activas |
| Webhooks | ✅ 9/9 | Con secret |
| Telegram | ✅ @aion_clave_bot | Operativo |
| eWeLink | ✅ 86 dispositivos | Conectados |
| Video | ✅ 360 streams | H.264 fMP4 |
| Asterisk PBX | ✅ 81 endpoints | 3 transportes (UDP/TLS/WSS) |
| Platform Server | ✅ | ISUP 7660 + Dahua 7681 |
| ISAPI Alerts | ✅ | Listener activo |
| Face Recognition | ✅ | PM2 online |
| PM2 | ✅ 19 online | 0 errored |
| Security | ✅ | SSL, 6 headers, 4 jails, SSH key-only |
| Database | ✅ 143 tablas | 11,500+ rows |
| Cron Jobs | ✅ 14 activos | Watchdog, backup, sync |

---

## LO QUE DEBES HACER TÚ (Isabella)

### Prioridad 1 — Credenciales externas

| # | Acción | Impacto | Tiempo |
|---|--------|---------|--------|
| 1 | **AWS Access Key + Secret** | Backup offsite a S3 | 5 min |
| 2 | **Meta WA_PHONE_NUMBER_ID + WA_ACCESS_TOKEN** | WhatsApp Business activo | 5 min |

### Prioridad 2 — Configuración de dispositivos

| # | Acción | Guía | Tiempo |
|---|--------|------|--------|
| 3 | **Cambiar substream H.264** en todos los DVR/NVR | GUIA_CONFIGURACION_DISPOSITIVOS.md | 3 días |
| 4 | **Configurar Platform Access** en DVR Dahua (sin IP pública) | GUIA_CONFIGURACION_DISPOSITIVOS.md | 1 día |
| 5 | **Configurar ISUP/EHome** en DVR Hikvision SDK | GUIA_CONFIGURACION_DISPOSITIVOS.md | 1 día |
| 6 | **Instalar softphones** en todos los puestos | GUIA_CONFIGURACION_ASTERISK.md | 2 días |

### Prioridad 3 — Coordenadas y recursos

| # | Acción | Para qué |
|---|--------|----------|
| 7 | **GPS de cada sede** (lat/lng) | Mapa interactivo de Medellín |
| 8 | **Logo SVG vectorial** | Branding crisp en todas resoluciones |
| 9 | **Fotos de fachada** de cada edificio | Thumbnails en cards de sitios |

---

## MEJORAS TÉCNICAS PENDIENTES (para próxima sesión)

### Backend

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | **SQL injection fix en operational-data/service.js** — 17 sql.raw() restantes en VPS | Seguridad | 2 horas |
| 2 | **Consolidar VPS plugins en código fuente** — Los 6 plugins JS viven solo en VPS dist/, deben estar en src/ para sobrevivir rebuilds | Mantenimiento | 1 hora |
| 3 | **Fix /clips endpoint** — Query a tabla vacía da 500 | Funcional | 15 min |
| 4 | **WebSocket real-time hub** — @fastify/websocket para eventos push al frontend | Video Wall + real-time | 4 horas |
| 5 | **ISAPI alertStream mejorado** — Reconexión más robusta, parseo de XML completo | Eventos Hikvision | 2 horas |

### Frontend

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 6 | **Mapa interactivo de sedes** — Leaflet con pins por sede (necesita GPS) | Visualización geográfica | 2 horas |
| 7 | **Reporte PDF automático** — Generar PDF diario con pdfkit | Valor al cliente | 4 horas |
| 8 | **Voice Assistant mejorado** — Conectar VoiceAssistant.tsx con AI chat real | Hands-free | 2 horas |
| 9 | **Drag & drop en video grid** — @dnd-kit para reordenar cámaras | UX LiveView | 3 horas |
| 10 | **Notificaciones push nativas** — VAPID keys ya configuradas, falta trigger | Push al celular | 2 horas |

### Video

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 11 | **Dahua DVRIP streams** — go2rtc soporta dvrip:// nativo | 108 cámaras con video real | 1 hora (config) |
| 12 | **IMOU video cuando API reset** — imou_video_setup.py auto-ejecuta | 90 cámaras Dahua | Automático |
| 13 | **Cambiar substream H.264** — Elimina transcodificación CPU | 100+ streams sin CPU | Tu acción |

### Infraestructura

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 14 | **Upgrade VPS a c6i.2xlarge** — 8 cores, CPU dedicado | 50+ streams simultáneos | 5 min (AWS Console) |
| 15 | **Prometheus + Grafana** — Monitoreo visual de métricas | Observabilidad | 4 horas |
| 16 | **GitHub Actions CI/CD** — Deploy automático al push | DevOps | 2 horas |
| 17 | **Staging environment** — VPS separado para testing | QA | Tu acción |

### Compliance

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 18 | **Registro SIC** — Registrar base de datos ante SuperIntendencia | Legal obligatorio | Tu acción |
| 19 | **Consentimiento biométrico** — Integrar GDPR module con face recognition | Ley 1581 | 2 horas |
| 20 | **Retención de datos automática** — Motor que elimina datos vencidos | Compliance | 3 horas |

---

## PRIORIZACIÓN RECOMENDADA

### Semana 1 (tú)
- [ ] Cambiar substream H.264 en todos los DVR/NVR
- [ ] Configurar Platform Access en Dahua
- [ ] Instalar softphones en puestos
- [ ] Probar plataforma desde central de monitoreo

### Semana 2 (desarrollo)
- [ ] Consolidar VPS plugins en código fuente
- [ ] SQL injection fix
- [ ] WebSocket real-time hub
- [ ] Reporte PDF automático

### Semana 3 (mejoras)
- [ ] Mapa interactivo (con tus coordenadas GPS)
- [ ] Voice assistant mejorado
- [ ] Push notifications trigger
- [ ] Dahua DVRIP streams

### Mes 2
- [ ] Upgrade VPS si necesitas >50 streams
- [ ] Prometheus + Grafana
- [ ] CI/CD pipeline
- [ ] Registro SIC

---

*Roadmap generado para Clave Seguridad CTA — AION Platform — Abril 2026*
