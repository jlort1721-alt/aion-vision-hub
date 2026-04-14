# Triage Hikvision Offline — 2026-04-14

## Resumen

5 DVR Hikvision con snapshots stale (>28h sin actualizar).
Diagnostico remoto ejecutado desde VPS 18.230.40.6.

**Hallazgo principal:** NINGUNO esta realmente offline. Los 5 tienen puertos TCP abiertos
y 3 de 5 registran activamente al platform-server. El problema es que hik_pull
(ISUP outbound) falla, probablemente por sesiones colgadas o credenciales.

## Tabla de Triage

| Device ID | Sitio | WAN IP | Ping | TCP Port | HTTP:80 | hik_pull | Registra | Categoria |
|---|---|---|---|---|---|---|---|---|
| SSDVR001 | San Sebastian | 186.97.106.252 | NO | OPEN (:8000) | timeout | FAIL | SI | CAT-5 |
| AGDVR001 | Altagracia | 181.205.175.18 | NO | OPEN (:8030) | 200 | FAIL | NO | CAT-2 |
| ARDVR001 | Altos del Rosario | 190.159.37.188 | NO | OPEN (:8010) | timeout | FAIL | SI | CAT-5 |
| PQDVR001 | Pisquines | 181.205.202.122 | NO | OPEN (:8020) | 200 | FAIL | SI | CAT-5 |
| TLDVR001 | Torre Lucia | 181.205.215.210 | SI | OPEN (:8010) | timeout | FAIL | SI | CAT-2 |

## Categorias

- **CAT-2:** IP responde pero protocolo ISUP falla. DVR posiblemente reiniciado, sesion colgada, o credenciales cambiadas.
- **CAT-5:** IP no pingable desde VPS pero dispositivo registra inbound. NAT/firewall bloquea ICMP pero permite TCP outbound.

## Acciones por Dispositivo

### TLDVR001 (Torre Lucia DVR) — Prioridad ALTA
- **Diagnostico:** Ping responde, TCP abierto, registra, pero hik_pull falla
- **Causa probable:** Este DVR usa password `seg12345` (diferente al estandar `Clave.seg2023`). El snap process `snap-tl-dvr` puede estar usando el password incorrecto.
- **Accion:** Verificar y corregir password en el snap process. Si se resuelve, +1 device healthy inmediatamente.

### SSDVR001 (San Sebastian) — Prioridad MEDIA
- **Diagnostico:** No responde ping pero registra al platform-server
- **Causa probable:** Sesion ISUP colgada en el DVR (el DVR mantiene una sesion activa con el platform-server y rechaza nuevas conexiones outbound desde hik_pull)
- **Accion:** Reiniciar el DVR remotamente via ISAPI (si acceso web disponible) o presencialmente

### ARDVR001 (Altos del Rosario) — Prioridad MEDIA
- **Diagnostico:** Similar a SSDVR001 — registra pero hik_pull falla
- **Causa probable:** Sesion ISUP colgada
- **Accion:** Reiniciar DVR

### PQDVR001 (Pisquines DVR) — Prioridad MEDIA
- **Diagnostico:** HTTP:80 responde (200), registra, pero hik_pull falla
- **Causa probable:** El DVR comparte WAN IP con PQNVR001 (que SI funciona). El NAT port-forward para el DVR (:8020) puede estar roto.
- **Accion:** Verificar NAT en el router del sitio. PQNVR001 en :8010 funciona, asi que el internet esta OK.

### AGDVR001 (Altagracia) — Prioridad BAJA
- **Diagnostico:** HTTP:80 responde pero no registra al platform-server
- **Causa probable:** DVR fue reiniciado y perdio la configuracion ISUP/EHome
- **Accion:** Re-configurar ISUP en el DVR via ISAPI desde el puerto HTTP:80 que SI responde

## Resolucion Esperada

Con el Go reverse-gateway + SDKs, los 3 dispositivos que YA registran inbound (SSDVR001, ARDVR001, PQDVR001) conectarian automaticamente sin intervencion. El gateway establece sesiones SDK reales, no depende de hik_pull outbound.

Solo AGDVR001 (no registra) y TLDVR001 (password incorrecto) requieren accion manual.
