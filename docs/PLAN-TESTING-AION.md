# AION SECURITY PLATFORM
## Plan de Testing y Fases de Desarrollo
### Clave Seguridad CTA

**Versión:** 2.0 | **Fecha:** Abril 2026

---

# FASE 1: PRUEBAS DE ACEPTACIÓN (UAT) — Semana 1

## 1.1 Pruebas de acceso y autenticación

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| AUTH-01 | Login exitoso | Ingresar email y password válidos | Redirige al Dashboard | ☐ |
| AUTH-02 | Login fallido | Ingresar password incorrecto | Muestra "Credenciales inválidas" | ☐ |
| AUTH-03 | Sesión persistente | Cerrar pestaña y reabrir | Sesión activa (JWT refresh) | ☐ |
| AUTH-04 | Logout | Clic en cerrar sesión | Redirige a login, JWT invalidado | ☐ |
| AUTH-05 | Role super_admin | Login como super_admin | Acceso a todos los módulos | ☐ |
| AUTH-06 | Role operator | Login como operator | Sin acceso a Admin y Auditoría | ☐ |
| AUTH-07 | Sesión expirada | Esperar 24h sin actividad | Solicita re-login automáticamente | ☐ |
| AUTH-08 | Múltiples sesiones | Login desde 2 navegadores | Ambas sesiones funcionan | ☐ |

## 1.2 Pruebas del Dashboard

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| DASH-01 | Carga del dashboard | Navegar a /dashboard | Todos los indicadores visibles < 3s | ☐ |
| DASH-02 | Datos de eventos | Verificar contador de eventos 24h | Coincide con /events filtrado | ☐ |
| DASH-03 | Datos de incidentes | Verificar incidentes activos | Coincide con /incidents?status=open | ☐ |
| DASH-04 | Refresh automático | Esperar 30 segundos | Datos se actualizan sin recargar | ☐ |
| DASH-05 | Navegación por clic | Clic en indicador de eventos | Navega a /events | ☐ |
| DASH-06 | Responsive | Abrir en tablet (iPad) | Layout se adapta | ☐ |
| DASH-07 | Responsive mobile | Abrir en celular | Layout usable, no roto | ☐ |

## 1.3 Pruebas de videovigilancia

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| VID-01 | Cargar vista en vivo | Ir a /live | Grid de cámaras visible | ☐ |
| VID-02 | Stream WebRTC | Seleccionar 1 cámara | Video fluido < 1s latencia | ☐ |
| VID-03 | Grid 2x2 | Seleccionar grid 2x2 | 4 cámaras simultáneas | ☐ |
| VID-04 | Grid 4x4 | Seleccionar grid 4x4 | 16 cámaras simultáneas sin lag | ☐ |
| VID-05 | Filtro por sede | Seleccionar "Torre Lucia" | Solo 24 cámaras de esa sede | ☐ |
| VID-06 | Pantalla completa | Doble clic en cámara | Ocupa toda la pantalla | ☐ |
| VID-07 | Cambio de sede | Cambiar filtro a "Brescia" | Se cargan las cámaras nuevas | ☐ |
| VID-08 | 328 cámaras | Verificar total de cámaras | 328 en la lista | ☐ |
| VID-09 | Cámara Hikvision | Abrir cámara de San Nicolás | Stream RTSP funcional | ☐ |
| VID-10 | Cámara Dahua/IMOU | Abrir cámara de Brescia | Stream P2P funcional | ☐ |
| VID-11 | Multi-usuario | 3 operadores viendo video | Sin degradación | ☐ |
| VID-12 | Multi-usuario max | 12 operadores simultáneos | Funcional con posible latencia | ☐ |

## 1.4 Pruebas de eventos

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| EVT-01 | Listar eventos | Ir a /events | Lista de eventos con paginación | ☐ |
| EVT-02 | Filtrar por severidad | Filtrar "critical" | Solo eventos críticos | ☐ |
| EVT-03 | Filtrar por sede | Seleccionar sede | Solo eventos de esa sede | ☐ |
| EVT-04 | Reconocer evento | Clic "Reconocer" en un evento | Estado cambia a "acknowledged" | ☐ |
| EVT-05 | Descartar evento | Clic "Descartar" + razón | Estado cambia a "dismissed" | ☐ |
| EVT-06 | Crear incidente desde evento | Clic "Crear Incidente" | Incidente creado con referencia | ☐ |
| EVT-07 | Búsqueda | Buscar por texto | Resultados relevantes | ☐ |
| EVT-08 | Paginación | Navegar páginas | Datos correctos en cada página | ☐ |

## 1.5 Pruebas de incidentes

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| INC-01 | Crear incidente | Llenar formulario completo | Incidente creado con ID | ☐ |
| INC-02 | Asignar prioridad | Crear con prioridad "critical" | Aparece en rojo en la lista | ☐ |
| INC-03 | Agregar comentario | Escribir comentario en timeline | Visible en la línea de tiempo | ☐ |
| INC-04 | Cambiar estado | Cambiar a "in_progress" | Estado actualizado | ☐ |
| INC-05 | Resolver incidente | Marcar como "resolved" | Fecha de resolución registrada | ☐ |
| INC-06 | Cerrar incidente | Cerrar con notas | Estado "closed", readonly | ☐ |
| INC-07 | Timeline completa | Ver toda la historia | Cada acción con fecha y autor | ☐ |
| INC-08 | Filtrar por estado | Filtrar "open" | Solo abiertos | ☐ |

## 1.6 Pruebas de control de acceso

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| ACC-01 | Buscar residente por nombre | Buscar "LÓPEZ" | Todos los López aparecen | ☐ |
| ACC-02 | Buscar por apartamento | Buscar "301" | Residentes del 301 | ☐ |
| ACC-03 | Buscar vehículo por placa | Buscar placa parcial | Resultados coincidentes | ☐ |
| ACC-04 | 1823 residentes | Verificar conteo total | 1823 registros | ☐ |
| ACC-05 | 971 vehículos | Verificar conteo total | 971 registros | ☐ |
| ACC-06 | Registrar visitante | Crear visitante nuevo | Registrado con hora de entrada | ☐ |
| ACC-07 | Marcar salida visitante | Clic "Salida" | Hora de salida registrada | ☐ |
| ACC-08 | Consignas | Buscar consigna por apto | Instrucción visible | ☐ |
| ACC-09 | Datos biométricos | Verificar conteo | 1410 registros | ☐ |

## 1.7 Pruebas de domótica

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| DOM-01 | Listar dispositivos | Ir a /domotics | 86 dispositivos listados | ☐ |
| DOM-02 | Estado online/offline | Verificar indicadores | Coincide con eWeLink real | ☐ |
| DOM-03 | Toggle ON | Encender un relé | Dispositivo enciende | ☐ |
| DOM-04 | Toggle OFF | Apagar un relé | Dispositivo apaga | ☐ |
| DOM-05 | Abrir puerta | Enviar pulse a puerta | Puerta abre 3s y cierra | ☐ |
| DOM-06 | Activar sirena | Activar sirena 5s | Suena 5s y se apaga | ☐ |
| DOM-07 | Dispositivo offline | Intentar toggle en device offline | Error claro, no se rompe | ☐ |

## 1.8 Pruebas del asistente IA

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| AI-01 | Abrir chat | Ir a /ai-assistant | Interfaz de chat funcional | ☐ |
| AI-02 | Pregunta simple | "¿Cuántas cámaras hay?" | Respuesta con número correcto (328) | ☐ |
| AI-03 | Buscar residente | "Busca al residente López" | Datos del residente | ☐ |
| AI-04 | Buscar placa | "Busca la placa ABC123" | Datos del vehículo o "no encontrado" | ☐ |
| AI-05 | Estado de sede | "Estado de Torre Lucia" | Resumen con cámaras, dispositivos | ☐ |
| AI-06 | Crear incidente | "Crea incidente: prueba" | Incidente creado, muestra ID | ☐ |
| AI-07 | Dashboard resumen | "Resumen del dashboard" | Datos del dashboard formateados | ☐ |
| AI-08 | Herramientas totales | Verificar en /mcp/tools | 83 tools | ☐ |
| AI-09 | Abrir puerta por IA | "Abre puerta de la sede X" | Puerta abierta, confirmación | ☐ |
| AI-10 | Respuesta en español | Preguntar en español | Respuesta en español | ☐ |

## 1.9 Pruebas de operaciones

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| OPS-01 | Ver turnos | Ir a /shifts | Turnos configurados visibles | ☐ |
| OPS-02 | Ver rutas de patrulla | Ir a /patrols | 2 rutas listadas | ☐ |
| OPS-03 | Reglas de automatización | Ir a /automation | 34 reglas listadas | ☐ |
| OPS-04 | Toggle automatización | Desactivar/activar regla | Estado cambia | ☐ |
| OPS-05 | Alertas activas | Ir a /alerts | 5 reglas de alerta | ☐ |
| OPS-06 | Datos operativos | Ir a /operational-data | 7+ secciones con datos | ☐ |

## 1.10 Pruebas de administración

| ID | Test | Pasos | Resultado esperado | Estado |
|----|------|-------|-------------------|--------|
| ADM-01 | Listar usuarios | Ir a /users | Usuarios del tenant | ☐ |
| ADM-02 | Roles | Ir a /roles | 2+ roles definidos | ☐ |
| ADM-03 | Audit logs | Ir a /audit | Registros de auditoría (super_admin) | ☐ |
| ADM-04 | Sedes | Ir a /sites | 25 sedes con direcciones | ☐ |
| ADM-05 | Tenant | Ir a /tenants/current | Datos del tenant actual | ☐ |
| ADM-06 | Compliance | Ir a /compliance | 3 plantillas | ☐ |
| ADM-07 | Contratos | Ir a /contracts | 2 contratos activos | ☐ |

---

# FASE 2: PRUEBAS DE INTEGRACIÓN — Semana 2

## 2.1 Flujo completo: Evento → Incidente → Resolución

```
Pasos:
1. Generar evento via webhook n8n
2. Verificar que aparece en /events
3. Reconocer el evento
4. Crear incidente desde el evento
5. Agregar comentario al incidente
6. Cambiar estado a "in_progress"
7. Resolver el incidente con notas
8. Verificar en audit log que todo quedó registrado
9. Verificar que el SLA se calculó correctamente

Resultado esperado: Todo el flujo funciona sin errores
```

## 2.2 Flujo completo: Visitante → Acceso → Salida

```
Pasos:
1. Pre-registrar visitante
2. Verificar que aparece en /visitors
3. Simular check-in (marcar entrada)
4. Verificar consignas del apartamento visitado
5. Marcar salida del visitante
6. Verificar en el log de acceso

Resultado esperado: Flujo completo documentado
```

## 2.3 Flujo completo: Emergencia Incendio

```
Pasos:
1. Activar protocolo de incendio para una sede
2. Verificar que se creó incidente CRÍTICO automáticamente
3. Verificar que las sirenas de la sede se activaron
4. Verificar notificación Telegram (si configurado)
5. Desactivar protocolo
6. Resolver incidente

Resultado esperado: Automatización ejecuta todos los pasos
```

## 2.4 Integración API → Frontend

| ID | Test | API Endpoint | Frontend |
|----|------|-------------|----------|
| INT-01 | Cámaras se muestran | GET /cameras (328) | /live muestra 328 cámaras |
| INT-02 | Búsqueda funciona | GET /operational-data/residents?search=X | /residents muestra resultados |
| INT-03 | Dashboard KPIs | GET /analytics/dashboard | /dashboard muestra los datos |
| INT-04 | Domótica online/offline | GET /domotics/devices | /domotics muestra estados |
| INT-05 | Video streaming | go2rtc /api/streams | /live reproduce video |

## 2.5 Integración Webhooks n8n

| ID | Webhook | Payload | Resultado |
|----|---------|---------|-----------|
| WH-01 | /webhooks/n8n/event | `{"event_type":"test","severity":"info"}` | Evento en DB |
| WH-02 | /webhooks/n8n/incident | `{"title":"Test incident"}` | Incidente en DB |
| WH-03 | /webhooks/n8n/device-status | `{"device_id":"...","new_status":"offline"}` | Device actualizado |
| WH-04 | /webhooks/n8n/visitor | `{"name":"Test","document":"123"}` | Visitante en DB |
| WH-05 | /webhooks/n8n/door-request | `{"site_id":"...","action":"open"}` | Acción registrada |
| WH-06 | /webhooks/n8n/security-alert | `{"title":"Test alert"}` | Alerta creada |
| WH-07 | /webhooks/n8n/health-report | `{"status":"ok"}` | Reporte registrado |
| WH-08 | /webhooks/n8n/patrol-checkpoint | `{"checkpoint_name":"C1"}` | Patrol log creado |
| WH-09 | /webhooks/n8n/emergency-activate | `{"description":"Test"}` | Activación creada |

---

# FASE 3: PRUEBAS DE SEGURIDAD — Semana 3

## 3.1 Autenticación y autorización

| ID | Test | Método | Resultado esperado |
|----|------|--------|-------------------|
| SEC-01 | API sin token | GET /cameras sin Authorization | HTTP 401 |
| SEC-02 | Token expirado | Request con JWT expirado | HTTP 401 + refresh flow |
| SEC-03 | Token inválido | Request con JWT falso | HTTP 401 |
| SEC-04 | Role bypass | Operator → GET /audit/logs | HTTP 403 |
| SEC-05 | Tenant isolation | User tenant A → datos tenant B | Sin resultados (aislamiento) |
| SEC-06 | Brute force login | 10 intentos fallidos rápidos | Rate limit activado |

## 3.2 Inyección y XSS

| ID | Test | Input | Resultado esperado |
|----|------|-------|-------------------|
| SEC-07 | SQL injection en búsqueda | `'; DROP TABLE residents--` | Error controlado, sin inyección |
| SEC-08 | SQL injection en login | Email: `admin' OR '1'='1` | Login fallido normal |
| SEC-09 | XSS en nombre | `<script>alert(1)</script>` como nombre | Se escapa correctamente |
| SEC-10 | XSS en incidente | Tags HTML en descripción | Se renderizan como texto |
| SEC-11 | Path traversal | `GET /../../etc/passwd` | HTTP 404 |
| SEC-12 | CORS origin | Request desde dominio externo | Bloqueado por CORS |

## 3.3 Headers y certificados

| ID | Test | Método | Resultado esperado |
|----|------|--------|-------------------|
| SEC-13 | HSTS | curl -sI | max-age=31536000 |
| SEC-14 | X-Frame-Options | curl -sI | SAMEORIGIN |
| SEC-15 | X-Content-Type-Options | curl -sI | nosniff |
| SEC-16 | CSP | curl -sI | Content-Security-Policy presente |
| SEC-17 | Referrer-Policy | curl -sI | strict-origin-when-cross-origin |
| SEC-18 | Permissions-Policy | curl -sI | camera=(self), microphone=(self) |
| SEC-19 | SSL válido | openssl s_client | No expirado, TLS 1.2+ |
| SEC-20 | SSL aiosystem.co | openssl s_client | Válido para dominio alterno |

---

# FASE 4: PRUEBAS DE RENDIMIENTO — Semana 3

## 4.1 Carga

| ID | Test | Herramienta | Resultado esperado |
|----|------|------------|-------------------|
| PERF-01 | Login rate | `ab -n 1000 -c 10` | > 100 req/s |
| PERF-02 | Dashboard carga | Navegador DevTools | < 3 segundos |
| PERF-03 | Lista cámaras | `curl -w time_total` | < 1 segundo |
| PERF-04 | Búsqueda residente | `curl -w time_total` | < 500ms |
| PERF-05 | Video WebRTC | Medir TTFB | < 2 segundos |
| PERF-06 | 12 operadores | 12 navegadores grid 4x4 | Sin caídas |
| PERF-07 | RAM bajo carga | `free -h` durante test | < 4GB usados |
| PERF-08 | CPU bajo carga | `top` durante test | < 80% promedio |

## 4.2 Estrés

| ID | Test | Descripción | Límite |
|----|------|-------------|--------|
| PERF-09 | Eventos masivos | Crear 1000 eventos via webhook | Sistema estable |
| PERF-10 | Búsquedas concurrentes | 50 búsquedas simultáneas | < 2s cada una |
| PERF-11 | Toggle dispositivos | 20 toggles simultáneos | Todos ejecutados |
| PERF-12 | Video + API | 12 streams + 20 API calls | Sin timeout |

---

# FASE 5: PRUEBAS DE PRODUCCIÓN — Semana 4

## 5.1 Escenarios del mundo real

| ID | Escenario | Duración | Qué verificar |
|----|-----------|----------|---------------|
| PROD-01 | Turno completo diurno | 8 horas | Sistema estable durante todo el turno |
| PROD-02 | Turno nocturno | 8 horas | Modo nocturno automático, alertas funcionan |
| PROD-03 | Cambio de turno | 30 min | Minuta automática, entrega correcta |
| PROD-04 | Simulacro de incendio | 15 min | Protocolo completo ejecutado |
| PROD-05 | Pérdida de conectividad sede | 10 min | Alerta de dispositivo offline |
| PROD-06 | Recuperación post-caída | 5 min | PM2 auto-restart, datos intactos |
| PROD-07 | Backup y restauración | 1 hora | pg_dump + restore en instancia de prueba |

## 5.2 Validación con usuarios reales

| ID | Usuario | Test | Criterio de éxito |
|----|---------|------|-------------------|
| UAT-01 | Operador turno día | Usar plataforma 1 turno | Puede hacer todo sin ayuda |
| UAT-02 | Operador turno noche | Turno completo nocturno | Alertas recibidas, eventos atendidos |
| UAT-03 | Supervisor | Revisar reportes y auditoría | Datos completos y correctos |
| UAT-04 | Administradora | Gestionar usuarios y configuración | Puede crear/editar sin errores |
| UAT-05 | Guardia de sede | Recibir llamada y abrir puerta | Comunicación bidireccional OK |

---

# FASE 6: GO-LIVE Y MONITOREO POST-LANZAMIENTO — Semana 4+

## 6.1 Checklist de Go-Live

```
☐ Todos los tests de Fase 1-4 pasados
☐ Backup completo realizado
☐ Operadores capacitados (mínimo 2)
☐ Supervisor capacitado
☐ Administradora capacitada
☐ Protocolos de emergencia revisados con equipo
☐ Números de emergencia (119, 123) accesibles
☐ Teléfono de soporte técnico disponible
☐ Manual del operador impreso en la central
☐ Acceso VPN/SSH al servidor documentado
```

## 6.2 Monitoreo primeras 72 horas

```
Hora 0-4:    Técnico presente en central, monitoreo activo
Hora 4-24:   Técnico disponible por teléfono, operador usa solo
Hora 24-48:  Revisión de logs de auditoría, correcciones menores
Hora 48-72:  Operación normal, soporte remoto si se necesita
```

## 6.3 Métricas de éxito post-lanzamiento

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| Uptime del sistema | > 99.5% | Monitored by health checks |
| Eventos respondidos < 5 min | > 90% | SLA compliance dashboard |
| Incidentes cerrados < 2h | > 80% | MTTR metric |
| Cámaras con stream activo | > 95% | go2rtc stream health |
| Dispositivos online | > 90% | Device status dashboard |
| Satisfacción operador | > 4/5 | Encuesta semanal |
| Falsos positivos reducidos | < 20% | Event analysis |

---

# APÉNDICE A: Comandos de verificación rápida (para técnico)

```bash
# Conectar al servidor
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6

# Estado general rápido
pm2 list && echo "" && \
curl -sf http://localhost:3001/health/ready && echo "" && \
redis-cli -a 'A10n_R3d1s_2026!' ping && echo "" && \
curl -sf http://localhost:1984/api/streams | python3 -c "import sys,json; print(f'Streams: {len(json.load(sys.stdin))}')"

# Test endpoints con token
export TOK=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jlort1721@gmail.com","password":"Jml1413031."}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Verificar endpoints clave
for ep in health/ready cameras sites events domotics/devices mcp/tools; do
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK" "http://localhost:3001/$ep")
  echo "$ep: $CODE"
done

# Ver logs de errores
pm2 logs aionseg-api --err --lines 20 --nostream

# Verificar espacio
df -h / | awk 'NR==2{print "Disco libre: "$4}'
free -h | awk '/Mem:/{print "RAM libre: "$7}'
```

---

*Plan de Testing — Clave Seguridad CTA*
*Documento confidencial*
