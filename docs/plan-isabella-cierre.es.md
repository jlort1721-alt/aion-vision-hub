# Plan de Cierre al 100% — Vision Hub v1.2.0

**Para:** Isabella (Clave Seguridad CTA)
**Fecha:** 2026-04-14
**Estado actual:** 10/23 dispositivos operativos (43%)

## Resumen

Tenemos 23 dispositivos de video (DVR/NVR/XVR) en 15 sitios. De estos, 10 ya reportan
saludable en el Vision Hub. Los 13 restantes estan bloqueados por 3 razones que requieren
accion externa. Con esas acciones, llegaremos al 100%.

## Los 3 bloqueos

### Bloqueo 1: SDKs de Hikvision y Dahua (afecta 8 dispositivos Hikvision)

**Que es:** El servidor central necesita unas bibliotecas de software propietarias de
Hikvision y Dahua para comunicarse directamente con los DVR. Son archivos que se descargan
de los portales de desarrollador de cada fabricante.

**Costo:** $0 (descarga gratuita con cuenta de desarrollador)

**Quien lo hace:** Isabella o equipo tecnico

**Pasos:**
1. Registrarse en https://open.hikvision.com/en/ con email corporativo
2. Descargar "HCNetSDK V6.x Linux 64-bit" (~100 MB)
3. Registrarse en https://www.dahuasecurity.com/support/developerCenter
4. Descargar "General NetSDK Linux x64" (~70 MB)
5. Subir ambos archivos al VPS via scp (documentacion en docs/sdk-installation.es.md)
6. Ejecutar los scripts de instalacion (2 comandos)

**Tiempo estimado:** 30 minutos (descarga + subida + instalacion)

**Impacto:** +8 dispositivos Hikvision se conectan automaticamente. De 10 a 18 operativos.

### Bloqueo 2: Registro IMOU de 4 Dahua (afecta 4 dispositivos)

**Que es:** 4 XVR Dahua no estan vinculados a la cuenta IMOU Cloud desde la cual el
sistema obtiene video. Necesitan ser agregados via la app IMOU Life.

**Dispositivos:**
- DNXVR002 — Danubios Puesto (serial: AH0306CPAZ5EA1A)
- TZXVR002 — Terrazzino 2 (serial: AH0306CPAZ5E9FA)
- SAXVR001 — Santa Ana Cabanas (serial: AB081E4PAZD6D5B)
- FCXVR001 — Factory (serial: 9B02D09PAZ4C0D2)

**Costo:** $0

**Quien lo hace:** Tecnico en sitio o remoto con acceso a la app IMOU Life

**Pasos:**
1. Abrir la app IMOU Life
2. Agregar dispositivo > Escanear QR o ingresar serial
3. Verificar que el dispositivo aparece online en la app
4. El sistema lo detecta automaticamente en el siguiente ciclo (15 min)

**Tiempo estimado:** 10 minutos por dispositivo

**Impacto:** +4 dispositivos Dahua. De 18 a 22 operativos.

### Bloqueo 3: Diagnostico de 5 Hikvision con hik_pull fallando

**Que es:** 5 DVR Hikvision tienen el puerto de conexion abierto y 3 de ellos se registran
activamente en el servidor, pero el sistema de snapshots no logra obtener imagen. Esto
NO es porque esten apagados — estan vivos pero algo cambio en su configuracion.

**Diagnostico remoto (ya completado):**

| Sitio | DVR | Ping | Puerto TCP | Registra | Problema probable |
|---|---|---|---|---|---|
| San Sebastian | SSDVR001 | NO | ABIERTO | SI | Credenciales cambiadas o sesion ISUP colgada |
| Altagracia | AGDVR001 | NO | ABIERTO | NO | DVR reiniciado, ISUP desconfigurado |
| Altos del Rosario | ARDVR001 | NO | ABIERTO | SI | Sesion ISUP colgada en el DVR |
| Pisquines | PQDVR001 | NO | ABIERTO | SI | Sesion ISUP colgada en el DVR |
| Torre Lucia | TLDVR001 | SI | ABIERTO | SI | Credenciales de hik_pull incorrectas |

**Accion requerida para cada uno:**
1. **TLDVR001:** Probar con password `seg12345` (este DVR usa password diferente). Si funciona, actualizar el proceso snap.
2. **SSDVR001, ARDVR001, PQDVR001:** Reiniciar el DVR remotamente o presencialmente para liberar la sesion ISUP colgada.
3. **AGDVR001:** Re-configurar ISUP en el DVR (posiblemente fue reiniciado y perdio la configuracion).

**Costo:** Visita tecnica a 1-3 sitios ($50-150 por visita) o reinicio remoto si el DVR tiene acceso web.

**Tiempo estimado:** 1-2 dias

**Impacto:** De 22 a 23 operativos (100%).

## Cronograma Sugerido

| Dia | Accion | Resultado |
|---|---|---|
| **Lunes** | Descargar SDKs de portales Hik+Dahua, subir al VPS, ejecutar scripts | 10 → 18 operativos (78%) |
| **Martes** | Registrar 4 Dahua en IMOU Life | 18 → 22 operativos (96%) |
| **Miercoles** | Reiniciar DVR TLDVR001 y probar con password seg12345 | 22 → 23 operativos si TLDVR001 se resuelve |
| **Jueves** | Visita a San Sebastian y Pisquines para reiniciar DVRs | Resolver 2-3 DVRs mas |
| **Viernes** | Verificacion final, tag v1.2.0-vision-hub | **100% operativo** |

## Contacto

Para cualquier duda sobre los pasos tecnicos, consultar la documentacion en:
- `docs/sdk-installation.es.md` — Instalacion de SDKs
- `docs/operator-manual.es.md` — Manual del operador
- Dashboard en vivo: https://aionseg.co/vision-hub
