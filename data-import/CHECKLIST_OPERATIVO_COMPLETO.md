# CHECKLIST OPERATIVO COMPLETO — Clave Seguridad

## Resumen: 39 módulos → qué necesita cada uno para funcionar al 100%

### Leyenda de estado
- **[DB]** = Requiere datos en base de datos (CSV + script de importación)
- **[ENV]** = Requiere variable de entorno en `.env`
- **[SVC]** = Requiere servicio externo corriendo
- **[API]** = Requiere API key o token externo
- **[UI]** = Se configura desde la interfaz web
- **[HW]** = Requiere hardware físico

---

## INFRAESTRUCTURA BASE (obligatorio para todo)

| # | Componente | Tipo | Cómo configurar | Estado |
|---|-----------|------|-----------------|--------|
| 1 | PostgreSQL 16 | [SVC] | `docker-compose up postgres` | ☐ |
| 2 | Redis 7 | [SVC] | `docker-compose up redis` | ☐ |
| 3 | MediaMTX | [SVC] | `docker-compose up mediamtx` | ☐ |
| 4 | Backend Fastify | [SVC] | `cd backend && pnpm dev:api` | ☐ |
| 5 | Frontend React | [SVC] | `pnpm dev` | ☐ |
| 6 | DATABASE_URL | [ENV] | `.env` → `postgres://...` | ☐ |
| 7 | JWT_SECRET | [ENV] | `openssl rand -base64 48` | ☐ |
| 8 | CREDENTIAL_ENCRYPTION_KEY | [ENV] | `openssl rand -hex 16` | ☐ |
| 9 | CORS_ORIGINS | [ENV] | URLs del frontend | ☐ |
| 10 | Supabase Auth | [SVC][ENV] | `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` | ☐ |
| 11 | Tenant creado | [DB] | Ejecutar `seed-production.sql` | ☐ |
| 12 | Usuario admin | [DB] | Registrarse en la app + `promote-admin.sql` | ☐ |
| 13 | Ejecutar migraciones | [DB] | `scripts/migrate-all.sh` | ☐ |

---

## MÓDULOS — Detalle completo

### 1. Panel Principal (Dashboard)
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Sitios cargados | [DB] | `01_sites.csv` | Al menos 1 sitio |
| Dispositivos cargados | [DB] | `03_devices_ip.csv` / `04_devices_p2p.csv` | Equipos registrados |
| Eventos existentes | [DB] | Se generan automáticamente | Al conectar dispositivos |

### 2. Vista en Vivo (Live View)
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| MediaMTX corriendo | [SVC] | `MEDIAMTX_API_URL` | Default: `http://localhost:9997` |
| Dispositivos con IP/stream | [DB] | `03_devices_ip.csv` | IP, puerto, usuario, contraseña de cada cámara |
| Streams registrados | [DB] | Se auto-registran al agregar dispositivos | O usar `scripts/register-streams.ts` |
| WebRTC URL (frontend) | [ENV] | `VITE_WEBRTC_URL` | Default: `http://localhost:8889` |

### 3. Reproducción (Playback)
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Dispositivos con grabación | [DB] | DVR/NVR en `03_devices_ip.csv` | Deben tener disco duro con grabaciones |
| Acceso a RTSP de grabación | [HW] | IP + credenciales del DVR | El DVR debe permitir playback RTSP |

### 4. Eventos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Dispositivos conectados | [DB] | Dispositivos importados | Generan eventos automáticamente |
| Reglas de alerta (opcional) | [DB] | `16_alert_rules.csv` | Para clasificación automática |

### 5. Alertas
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Reglas de alerta | [DB] | `16_alert_rules.csv` | 10 reglas pre-configuradas |
| Canales de notificación | [DB] | `17_notification_channels.csv` | Email, WhatsApp, push, webhook |
| Email configurado | [ENV] | `SMTP_*` o `RESEND_API_KEY` | Para alertas por correo |
| WhatsApp (opcional) | [ENV] | `WHATSAPP_*` | Para alertas por WhatsApp |
| Push (opcional) | [ENV] | `VAPID_*` | Para alertas push en navegador |

### 6. Incidentes
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Eventos existentes | [DB] | Generados por dispositivos | Base para crear incidentes |
| IA para resúmenes (opcional) | [ENV] | `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` | Resúmenes automáticos |

### 7. Dispositivos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Equipos por IP | [DB] | `03_devices_ip.csv` | IP, puerto, usuario, contraseña, marca, modelo |
| Equipos por P2P | [DB] | `04_devices_p2p.csv` | Serial, usuario, contraseña, tipo conexión |
| Cuentas cloud | [UI] | `05_cloud_accounts.csv` (ref) | Login desde Panel Cloud en la UI |
| Cifrado activo | [ENV] | `CREDENTIAL_ENCRYPTION_KEY` | Cifra credenciales en BD |

### 8. Sitios
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Datos de sitios | [DB] | `01_sites.csv` | Nombre, dirección, IP WAN, coordenadas |

### 9. Domóticos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Credenciales eWeLink | [ENV] | `EWELINK_APP_ID` + `EWELINK_APP_SECRET` | Registrar en dev.ewelink.cc |
| Dispositivos Sonoff | [DB] | `25_domotic_devices.csv` | Relés, switches registrados |
| Dispositivos físicos | [HW] | Sonoff BASIC/MINI/4CH | Vinculados a cuenta eWeLink |

### 10. Control de Acceso
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Residentes/personas | [DB] | `06_residents.csv` | Nombre, cédula, teléfono, unidad |
| Vehículos | [DB] | `07_vehicles.csv` | Placa, marca, modelo, vinculado por cédula |
| Secciones/zonas | [DB] | `02_sections.csv` | Porterías, torres, zonas |
| ZKTeco (opcional) | [HW] | IP del panel de acceso | Paneles InBio/ProBio |

### 11. Reinicios
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Dispositivos con acceso | [DB] | Dispositivos importados con credenciales | Se reinician vía HTTP/ONVIF |

### 12. Citofonía IP
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| PBX (Asterisk/FreePBX) | [SVC][HW] | `SIP_HOST`, `SIP_PORT` | Servidor SIP configurado |
| ARI credentials | [ENV] | `SIP_ARI_URL`, `SIP_ARI_USERNAME`, `SIP_ARI_PASSWORD` | Para control de llamadas |
| Intercomunicadores | [DB][HW] | `24_intercom_devices.csv` | Fanvil i33V, i23S, etc. |
| Credenciales Fanvil | [ENV] | `FANVIL_ADMIN_USER`, `FANVIL_ADMIN_PASSWORD` | Admin de dispositivos Fanvil |
| ElevenLabs TTS | [API] | `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID` | Voz para saludos automáticos |
| Config VoIP | [UI] | Configurar desde /intercom | Plantillas de saludo, DTMF |
| SIP en frontend | [ENV] | `VITE_SIP_SERVER`, `VITE_SIP_PORT`, `VITE_SIP_DOMAIN` | Para llamadas desde navegador |

### 13. Turnos y Guardias
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Turnos definidos | [DB] | `09_shifts.csv` | Horarios diurno/nocturno por sitio |
| Usuarios guardas | [DB] | Registrados en la plataforma | Con rol `operator` o `guard` |

### 14. Patrullas
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Rutas de patrulla | [DB] | `12_patrol_routes.csv` | Rutas por sitio con frecuencia |
| Puntos de control | [DB] | `13_patrol_checkpoints.csv` | Checkpoints con QR y foto requerida |
| Códigos QR impresos | [HW] | Generar QR con los códigos del CSV | Pegar en cada punto físico |

### 15. Puestos (Secciones)
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Secciones por sitio | [DB] | `02_sections.csv` | Porterías, torres, parqueaderos, zonas |

### 16. Visitantes
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Secciones configuradas | [DB] | `02_sections.csv` | Para asignar visitantes a zonas |
| Config de visitas | [UI] | Panel de visitantes | Tipos de pase, duración, requisitos |

### 17. Emergencias
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Protocolos de emergencia | [DB] | `15_emergency_protocols.csv` | 6 protocolos pre-configurados |
| Contactos de emergencia | [DB] | `08_emergency_contacts.csv` | CAI, bomberos, administrador, supervisor |
| Notificaciones activas | [ENV] | Email y/o WhatsApp configurado | Para alertas de emergencia |

### 18. Gestión SLA
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Definiciones SLA | [DB] | `14_sla_definitions.csv` | 10 SLAs con tiempos de respuesta/resolución |

### 19. Automatización
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Reglas de automatización | [DB] | `18_automation_rules.csv` | 7 reglas pre-configuradas |
| Canales de notificación | [DB] | `17_notification_channels.csv` | Para acciones automáticas |

### 20. Minuta de Turno
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Turnos configurados | [DB] | `09_shifts.csv` | Para vincular minutas a turnos |
| Secciones | [DB] | `02_sections.csv` | Para ubicar novedades |

### 21. Panel Telefónico
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| PBX configurado | [SVC] | Mismo que Citofonía IP | `SIP_HOST`, `SIP_ARI_*` |
| Extensiones SIP | [HW] | Configurar en PBX | Extensiones para operadores |

### 22. Asistente IA
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Proveedor de IA | [API] | `OPENAI_API_KEY` y/o `ANTHROPIC_API_KEY` | Al menos uno obligatorio |
| Feature flag activo | [DB] | `ai_assistant` flag = true | Ya activo en seed |

### 23. Analíticas
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Datos históricos | [DB] | Eventos, incidentes, accesos | Se acumulan con el uso |
| IA (opcional) | [API] | OpenAI/Anthropic | Para análisis avanzado |

### 24. Reportes
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Datos existentes | [DB] | Eventos, dispositivos, accesos | Se generan con data existente |

### 25. Reportes Programados
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Email configurado | [ENV] | `SMTP_*` o `RESEND_API_KEY` | Para enviar reportes por correo |
| Cron del backend | [SVC] | Backend corriendo | Ejecuta reportes automáticamente |

### 26. Base de Datos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| PostgreSQL | [SVC] | Ya cubierto en infraestructura base | Funciona automáticamente |

### 27. Notas Operativas
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Secciones | [DB] | `02_sections.csv` | Para categorizar notas |

### 28. Documentos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Ninguno especial | — | Funciona con la BD base | CRUD de documentos |

### 29. Contratos
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Datos de contratos | [DB] | `10_contracts.csv` | Número, cliente, valor, servicios |

### 30. Gestión de Llaves
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Inventario de llaves | [DB] | `19_key_inventory.csv` | Llaves por sitio con asignación |

### 31. Cumplimiento
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Plantillas de cumplimiento | [DB] | `20_compliance_templates.csv` | Habeas data, retención, LPDP |
| Políticas de retención | [DB] | `21_data_retention_policies.csv` | Tiempos de retención por tipo |

### 32. Capacitación
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Programas de capacitación | [DB] | `22_training_programs.csv` | 10 programas pre-configurados |

### 33. WhatsApp
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Cuenta Meta Business | [API] | developers.facebook.com | Crear app WhatsApp Business |
| Phone Number ID | [ENV] | `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono |
| Access Token | [ENV] | `WHATSAPP_ACCESS_TOKEN` | Token permanente de la API |
| Business Account ID | [ENV] | `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID de la cuenta business |
| Verify Token | [ENV] | `WHATSAPP_VERIFY_TOKEN` | Para verificar webhook |
| App Secret | [ENV] | `WHATSAPP_APP_SECRET` | Para validar firma HMAC |
| Webhook público | [SVC] | URL pública del backend | Meta envía mensajes entrantes |

### 34. Integraciones
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Datos base | [DB] | Funciona con integraciones registradas | Se gestionan desde la UI |

### 35. Auditoría
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Ninguno especial | — | Se registra automáticamente | Cada acción se loguea |

### 36. Salud del Sistema
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Prometheus (opcional) | [SVC] | `PROMETHEUS_ENABLED=true` | Métricas del sistema |
| Grafana (opcional) | [SVC] | `GRAFANA_ADMIN_PASSWORD` | Dashboards visuales |
| Backend healthcheck | [SVC] | `GET /health` | Ya implementado |

### 37. Configuración
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Tenant creado | [DB] | Seed ejecutado | Configuración del tenant |
| Feature flags | [DB] | Ya en seed.sql | Activar/desactivar módulos |

### 38. Administración
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Usuario super_admin | [DB] | Registro + `promote-admin.sql` | Permisos completos |
| Permisos por rol | [DB] | Ya en seed.sql | `role_module_permissions` |

### 39. Centro de Red
| Requisito | Tipo | Archivo/Variable | Detalle |
|-----------|------|-------------------|---------|
| Red local accesible | [SVC] | `DISCOVERY_NETWORK_RANGE` | Rango de red a escanear |
| Edge Gateway | [SVC] | `pnpm dev:gateway` | Para descubrimiento ONVIF |

---

## RESUMEN: TOKENS Y API KEYS NECESARIOS

### Obligatorios (sin estos no funciona)
| Token/Key | Dónde obtener | Variable |
|-----------|--------------|----------|
| Supabase URL + Anon Key | supabase.com/dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| JWT Secret | `openssl rand -base64 48` | `JWT_SECRET` |
| Encryption Key | `openssl rand -hex 16` | `CREDENTIAL_ENCRYPTION_KEY` |
| DB Password | Definir uno seguro | `POSTGRES_PASSWORD` |

### Para módulos específicos
| Token/Key | Módulos que habilita | Dónde obtener |
|-----------|---------------------|--------------|
| **SMTP credentials** | Alertas, Reportes, Notificaciones | Gmail App Password o Resend/SendGrid |
| **OPENAI_API_KEY** | Asistente IA, Analíticas, Resúmenes | platform.openai.com/api-keys |
| **ANTHROPIC_API_KEY** | Asistente IA (alternativa) | console.anthropic.com |
| **WHATSAPP_* (5 vars)** | WhatsApp, Alertas WA | developers.facebook.com |
| **EWELINK_APP_ID/SECRET** | Domóticos (Sonoff) | dev.ewelink.cc |
| **ELEVENLABS_API_KEY** | Citofonía (voz TTS) | elevenlabs.io |
| **SIP_* (6 vars)** | Citofonía IP, Panel Telefónico | Tu servidor Asterisk/FreePBX |
| **FANVIL_* (2 vars)** | Intercomunicadores Fanvil | Credenciales del dispositivo |
| **VAPID_* (2 keys)** | Push Notifications | `npx tsx scripts/generate-vapid-keys.ts` |
| **GRAFANA_ADMIN_PASSWORD** | Dashboards de monitoreo | Definir uno seguro |

---

## ORDEN DE EJECUCIÓN PARA PUESTA EN MARCHA

```
PASO 1: INFRAESTRUCTURA
├── Instalar Docker, Node 20, pnpm
├── Copiar .env.complete.template → backend/.env
├── Copiar .env.frontend.template → .env.local
├── Generar secretos (JWT, encryption key, VAPID)
├── docker-compose up -d postgres redis mediamtx
└── Ejecutar migraciones: scripts/migrate-all.sh

PASO 2: DATOS BASE
├── Ejecutar seed: psql -f scripts/seed-production.sql
├── Registrar usuario admin en la app
├── Promover a admin: psql -f scripts/promote-admin.sql
└── Verificar login funcional

PASO 3: DATOS OPERATIVOS (CSV → import-all.ts)
├── Editar 01_sites.csv con datos reales
├── Editar 02_sections.csv
├── Editar 03_devices_ip.csv + 04_devices_p2p.csv
├── Editar 06_residents.csv + 07_vehicles.csv
├── Editar todos los demás CSVs
├── npx tsx import-all.ts --dry-run (verificar)
└── npx tsx import-all.ts (importar)

PASO 4: CUENTAS CLOUD
├── Login HikConnect desde UI → Dispositivos → Panel Cloud
├── Login DMSS desde UI → Dispositivos → Panel Cloud
└── Importar dispositivos cloud

PASO 5: SERVICIOS EXTERNOS
├── Configurar SMTP en .env (Gmail App Password)
├── Configurar WhatsApp Business (si aplica)
├── Configurar AI provider (OpenAI o Anthropic)
├── Configurar eWeLink (si hay dispositivos Sonoff)
├── Configurar SIP/Asterisk (si hay citofonía)
└── Configurar ElevenLabs (si se usa voz)

PASO 6: VERIFICACIÓN
├── Dashboard muestra datos
├── Vista en vivo muestra cámaras
├── Control de acceso muestra residentes
├── Alertas y notificaciones funcionan
├── Reportes se generan correctamente
└── Todos los módulos accesibles
```

---

## ARCHIVOS ENTREGADOS

| # | Archivo | Propósito |
|---|---------|-----------|
| 1 | `templates/01_sites.csv` | Sitios/puestos con IP WAN |
| 2 | `templates/02_sections.csv` | Secciones por sitio |
| 3 | `templates/03_devices_ip.csv` | Equipos conexión IP directa |
| 4 | `templates/04_devices_p2p.csv` | Equipos conexión P2P |
| 5 | `templates/05_cloud_accounts.csv` | Cuentas HikConnect/DMSS (ref) |
| 6 | `templates/06_residents.csv` | Residentes y empleados |
| 7 | `templates/07_vehicles.csv` | Vehículos |
| 8 | `templates/08_emergency_contacts.csv` | Contactos de emergencia |
| 9 | `templates/09_shifts.csv` | Turnos de vigilancia |
| 10 | `templates/10_contracts.csv` | Contratos |
| 11 | `templates/11_email_accounts.csv` | Cuentas de correo (ref) |
| 12 | `templates/12_patrol_routes.csv` | Rutas de patrulla |
| 13 | `templates/13_patrol_checkpoints.csv` | Puntos de control QR |
| 14 | `templates/14_sla_definitions.csv` | Definiciones SLA |
| 15 | `templates/15_emergency_protocols.csv` | Protocolos de emergencia |
| 16 | `templates/16_alert_rules.csv` | Reglas de alerta |
| 17 | `templates/17_notification_channels.csv` | Canales de notificación |
| 18 | `templates/18_automation_rules.csv` | Reglas de automatización |
| 19 | `templates/19_key_inventory.csv` | Inventario de llaves |
| 20 | `templates/20_compliance_templates.csv` | Plantillas legales (LPDP) |
| 21 | `templates/21_data_retention_policies.csv` | Políticas de retención |
| 22 | `templates/22_training_programs.csv` | Programas de capacitación |
| 23 | `templates/23_visitors_config.csv` | Config visitantes (ref) |
| 24 | `templates/24_intercom_devices.csv` | Intercomunicadores |
| 25 | `templates/25_domotic_devices.csv` | Dispositivos domóticos |
| 26 | `.env.complete.template` | TODAS las variables backend |
| 27 | `.env.frontend.template` | Variables frontend (Vite) |
| 28 | `import-all.ts` | Script importación 22 pasos |
| 29 | `CHECKLIST_OPERATIVO_COMPLETO.md` | Este documento |
