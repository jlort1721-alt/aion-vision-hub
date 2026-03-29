# Plan de Respuesta a Incidentes de Seguridad de la Informacion

**Version:** 1.0
**Fecha:** 2026-03-29
**Clasificacion:** CONFIDENCIAL — Uso interno
**Responsable:** CTO / Lider de Seguridad
**Proxima revision:** Trimestral

---

## 1. Objetivo

Establecer los procedimientos para identificar, contener, erradicar y recuperarse de incidentes de seguridad de la informacion que afecten la plataforma AION (aionseg.co) y los datos bajo custodia de Clave Seguridad CTA.

## 2. Alcance

Aplica a todos los sistemas, servicios, datos y personal asociado a:
- Plataforma AION (frontend, backend, bases de datos)
- Infraestructura VPS (18.230.40.6)
- Integraciones con terceros (eWeLink, IMOU, go2rtc, Twilio)
- Datos de residentes, vehiculos, dispositivos IoT y video vigilancia
- Comunicaciones (correo, WhatsApp, VoIP/Asterisk)

## 3. Definiciones

- **Incidente de seguridad:** Evento que compromete la confidencialidad, integridad o disponibilidad de los datos o sistemas.
- **Brecha de datos personales:** Acceso no autorizado a datos personales protegidos por Ley 1581 de 2012.
- **Severidad Critica:** Perdida de datos personales, acceso no autorizado a produccion, exfiltracion de credenciales.
- **Severidad Alta:** Interrupcion de servicio >1 hora, fallo de autenticacion masivo, vulnerabilidad explotada.
- **Severidad Media:** Anomalia detectada sin impacto confirmado, fallo de componente no critico.
- **Severidad Baja:** Alerta falsa, error de configuracion menor corregido.

## 4. Equipo de Respuesta (CSIRT)

| Rol | Responsable | Contacto |
|-----|-------------|----------|
| Coordinador de incidentes | CTO | [EMAIL] |
| Lider tecnico | Ingeniero Senior | [EMAIL] |
| Comunicaciones | Gerencia General | [EMAIL] |
| Legal / Compliance | Asesor Legal | [EMAIL] |
| Operaciones | Lider de Operaciones | [EMAIL] |

## 5. Clasificacion de Incidentes

| Tipo | Ejemplos | Severidad |
|------|----------|-----------|
| Acceso no autorizado | Login fraudulento, escalamiento de privilegios | Critica |
| Fuga de datos | Exposicion de datos personales, credenciales en git | Critica |
| Malware/Ransomware | Codigo malicioso en servidor | Critica |
| Denegacion de servicio | DDoS, saturacion de recursos | Alta |
| Fallo de infraestructura | Caida de VPS, corrupcion de DB | Alta |
| Vulnerabilidad explotada | CVE activo en dependencia | Alta |
| Anomalia de acceso | Patrones inusuales sin confirmacion | Media |
| Error de configuracion | CORS mal configurado, header faltante | Media |
| Alerta falsa positiva | Trigger de monitoreo sin impacto | Baja |

## 6. Fases de Respuesta

### 6.1 Deteccion e Identificacion (0-30 minutos)

1. Monitoreo continuo via:
   - Logs de Fastify (pino) centralizados
   - Metricas de OpenTelemetry / Prometheus
   - Alertas de audit_logs en base de datos
   - Agente proactivo AION (health checks cada 5 min)
   - Redis rate-limiting alerts

2. Fuentes de deteccion:
   - Sistema de alertas automaticas
   - Reporte de operador o usuario
   - Notificacion de servicio externo
   - Escaneo SCA/CVE automatico

3. Registro inmediato:
   - Fecha/hora de deteccion
   - Fuente que detecto
   - Descripcion inicial
   - Severidad preliminar
   - Sistemas afectados

### 6.2 Contencion (30 min - 2 horas)

**Contencion inmediata:**
- Revocar tokens JWT comprometidos (invalidar en Redis)
- Bloquear IP sospechosa via rate-limiter o firewall
- Desconectar servicio afectado via PM2 (`pm2 stop <service>`)
- Cambiar credenciales comprometidas inmediatamente

**Contencion a corto plazo:**
- Aislar servidor afectado (security group AWS)
- Deshabilitar integracion comprometida
- Activar modo mantenimiento si necesario
- Preservar evidencia (snapshots, logs)

### 6.3 Erradicacion (2-24 horas)

1. Identificar causa raiz
2. Parchear vulnerabilidad o corregir configuracion
3. Eliminar artefactos maliciosos
4. Actualizar dependencias vulnerables
5. Validar que el vector de ataque esta cerrado

### 6.4 Recuperacion (24-72 horas)

1. Restaurar servicios desde backup si necesario
2. Verificar integridad de datos
3. Monitoreo intensivo post-incidente (24h)
4. Validar funcionamiento normal de todos los modulos
5. Comunicar restauracion a usuarios afectados

### 6.5 Lecciones Aprendidas (7 dias post-incidente)

1. Reunion post-mortem con CSIRT
2. Documentar:
   - Timeline completo del incidente
   - Que funciono bien
   - Que debe mejorar
   - Acciones preventivas
3. Actualizar este plan si aplica
4. Registrar en knowledge base de AION

## 7. Notificacion a Titulares (Ley 1581)

En caso de brecha que afecte datos personales:

| Accion | Plazo | Responsable |
|--------|-------|-------------|
| Notificacion interna al CSIRT | Inmediata | Quien detecte |
| Evaluacion de impacto | 24 horas | Lider tecnico + Legal |
| Notificacion a SIC | 15 dias habiles (Art. 17 Ley 1581) | Legal |
| Notificacion a titulares afectados | Tan pronto como sea posible | Comunicaciones |

Contenido minimo de la notificacion:
- Naturaleza de la brecha
- Datos comprometidos
- Medidas tomadas
- Recomendaciones al titular
- Canal de contacto para consultas

## 8. Herramientas de Respuesta

| Herramienta | Uso |
|-------------|-----|
| PM2 | Control de procesos (stop/restart/logs) |
| Redis CLI | Invalidacion de sesiones/tokens |
| PostgreSQL | Consulta de audit_logs, bloqueo de usuarios |
| AWS Console | Security groups, snapshots |
| Nginx | Bloqueo de IPs, modo mantenimiento |
| git | Reversion de cambios, historial |

## 9. Pruebas del Plan

- **Frecuencia:** Trimestral
- **Tipo:** Simulacro de mesa (tabletop exercise)
- **Documentacion:** Acta de simulacro con participantes, escenario, resultados
- **Siguiente simulacro:** [FECHA]

## 10. Indicadores

| Indicador | Meta |
|-----------|------|
| Tiempo de deteccion | < 30 minutos |
| Tiempo de contencion | < 2 horas |
| Tiempo de resolucion (critico) | < 24 horas |
| Incidentes sin documentar | 0 |
| Simulacros por ano | >= 4 |
