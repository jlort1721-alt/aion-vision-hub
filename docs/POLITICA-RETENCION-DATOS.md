# Politica de Retencion y Eliminacion de Datos

**Version:** 1.0
**Fecha:** 2026-03-29
**Clasificacion:** CONFIDENCIAL — Uso interno
**Base legal:** Ley 1581 de 2012, Decreto 1377 de 2013
**Responsable:** Legal / CTO
**Proxima revision:** Anual

---

## 1. Objetivo

Definir los periodos de retencion, las condiciones de eliminacion y los procedimientos de supresion de datos personales y operativos tratados por la plataforma AION de Clave Seguridad CTA, en cumplimiento de la Ley 1581 de 2012 y su decreto reglamentario.

## 2. Principios Rectores

Conforme al Articulo 4 de la Ley 1581:
- **Finalidad:** Los datos se conservan unicamente mientras cumplan la finalidad para la que fueron recolectados.
- **Necesidad:** Solo se almacenan los datos estrictamente necesarios.
- **Temporalidad:** Todo dato tiene un periodo maximo de retencion definido.
- **Seguridad:** Los datos se protegen durante todo su ciclo de vida, incluyendo la eliminacion.

## 3. Periodos de Retencion

### 3.1 Datos de Personas (Residentes, Visitantes, Personal)

| Tipo de dato | Periodo de retencion | Justificacion |
|-------------|---------------------|---------------|
| Datos de identificacion (nombre, documento, telefono) | Mientras exista relacion contractual + 1 ano | Obligacion contractual + periodo de reclamacion |
| Registros de acceso (entrada/salida) | 1 ano | Seguridad y trazabilidad |
| Datos de visitantes | 6 meses | Seguridad del inmueble |
| Datos biometricos (si aplica) | Mientras exista autorizacion vigente | Consentimiento reforzado requerido |
| Datos de vehiculos (placa, marca, color) | Mientras exista relacion contractual + 6 meses | Operacion de control vehicular |

### 3.2 Datos de Video Vigilancia

| Tipo de dato | Periodo de retencion | Justificacion |
|-------------|---------------------|---------------|
| Grabaciones de CCTV (DVR/NVR local) | 30 dias (almacenamiento local en sede) | Capacidad de almacenamiento + necesidad operativa |
| Eventos de camara (metadatos) | 1 ano | Analisis de seguridad e historico |
| Capturas/snapshots de evidencia | Hasta cierre de caso + 2 anos | Soporte probatorio |

### 3.3 Datos Operativos de Plataforma

| Tipo de dato | Periodo de retencion | Justificacion |
|-------------|---------------------|---------------|
| Logs de auditoria (audit_logs) | 2 anos | Trazabilidad y cumplimiento |
| Logs de acceso API | 90 dias | Seguridad y depuracion |
| Incidentes de seguridad | 3 anos | Historico operativo y patrones |
| Reportes generados | 1 ano | Referencia operativa |
| Conversaciones con agente AI | 90 dias | Mejora de servicio |
| Alertas y notificaciones | 6 meses | Referencia operativa |
| Backups de base de datos | 30 dias (rotacion) | Recuperacion ante desastres |

### 3.4 Datos de Dispositivos IoT

| Tipo de dato | Periodo de retencion | Justificacion |
|-------------|---------------------|---------------|
| Estado de dispositivos (on/off, online/offline) | Tiempo real (no se almacena historico) | Solo estado actual |
| Acciones domoticas (logs) | 6 meses | Auditoria de operacion |
| Credenciales de dispositivos | Mientras el dispositivo este activo | Operacion |

### 3.5 Datos de Cuenta de Usuario

| Tipo de dato | Periodo de retencion | Justificacion |
|-------------|---------------------|---------------|
| Credenciales (hash de contrasena) | Mientras la cuenta este activa | Autenticacion |
| Tokens de sesion (JWT/refresh) | 7 dias (refresh) / 15 min (access) | Seguridad de sesion |
| Perfil de usuario | Mientras la cuenta este activa + 30 dias | Periodo de gracia para reactivacion |

## 4. Procedimiento de Eliminacion

### 4.1 Eliminacion Automatica

La plataforma implementa eliminacion automatica para:
- Tokens JWT expirados: Eliminados por Redis TTL
- Logs de API mayores a 90 dias: Cron job de limpieza
- Backups mayores a 30 dias: Rotacion automatica

### 4.2 Eliminacion por Solicitud del Titular

Conforme a los Articulos 8 y 17 de la Ley 1581:

1. El titular presenta solicitud de supresion via canal PQRS
2. Se verifica identidad del titular (documento + correo registrado)
3. Se evalua si existen obligaciones legales que impidan la eliminacion
4. Si procede:
   - Se eliminan datos de las tablas activas
   - Se anonimiza en logs de auditoria (reemplazo con hash)
   - Se confirma al titular en maximo 15 dias habiles
5. Si no procede:
   - Se informa al titular la razon legal (plazo: 15 dias habiles)

### 4.3 Eliminacion por Fin de Relacion Contractual

Al terminar el contrato con una sede/cliente:
1. Notificacion 30 dias antes de la eliminacion programada
2. Exportacion de datos si el titular lo solicita
3. Eliminacion de datos personales de la base de datos
4. Mantenimiento de logs de auditoria anonimizados por el periodo reglamentario
5. Certificado de eliminacion emitido al titular

### 4.4 Metodos de Eliminacion

| Tipo | Metodo | Verificacion |
|------|--------|-------------|
| Datos en PostgreSQL | DELETE + VACUUM | Query de validacion post-eliminacion |
| Datos en Redis | DEL / EXPIRE | Verificacion de ausencia |
| Archivos en disco | Eliminacion segura (shred) | Verificacion de inaccesibilidad |
| Backups | Rotacion natural (30 dias) | No se eliminan backups individuales |

## 5. Excepciones a la Eliminacion

No se eliminan datos cuando:
- Existe obligacion legal de conservacion (ej: registros contables - 10 anos)
- Los datos son necesarios para ejercer o defender acciones legales
- Existe una orden judicial que impide la eliminacion
- Los datos han sido anonimizados y no permiten identificar al titular

## 6. Derechos del Titular

Conforme a la Ley 1581, el titular puede:
- **Consultar** sus datos: Respuesta en 10 dias habiles
- **Actualizar** sus datos: Respuesta en 15 dias habiles
- **Rectificar** datos incorrectos: Respuesta en 15 dias habiles
- **Solicitar supresion**: Respuesta en 15 dias habiles
- **Revocar autorizacion**: Respuesta en 15 dias habiles

Canal PQRS: protecciondatos@claveseguridad.co

## 7. Responsabilidades

| Rol | Responsabilidad |
|-----|----------------|
| CTO | Implementacion tecnica de la retencion y eliminacion |
| Legal | Interpretacion de plazos legales y respuesta a titulares |
| DevOps | Automatizacion de jobs de limpieza y rotacion |
| Operaciones | Gestion de solicitudes PQRS |
| Gerencia | Aprobacion de politica y excepciones |

## 8. Auditoria y Revision

- **Revision de la politica:** Anual o ante cambios regulatorios
- **Auditoria de cumplimiento:** Semestral
- **Verificacion de eliminacion automatica:** Mensual
- **Reporte a gerencia:** Trimestral
