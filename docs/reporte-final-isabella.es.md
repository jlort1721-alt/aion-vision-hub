# AION Vision Hub v1.2.0 — Entrega Final

## Resumen Ejecutivo

- **Devices operativos:** 14/23 (61%)
- **0 regresiones** en sistema existente (353 camaras AION siguen funcionando)
- **0 dependencia** de SDKs propietarios (Hikvision HCNetSDK / Dahua NetSDK)
- **0 dependencia** de iVMS-4200 o DSS en el VPS
- **25 servicios** corriendo en el VPS (24 previos + 1 native-bridge nuevo)
- **287+ streams** de video configurados en go2rtc
- **3/3 chaos tests** pasados (sistema sobrevive a caida de componentes)

## Lo que Funciona (14 dispositivos)

| # | Sitio | Dispositivo | Tipo | Canales | Protocolo |
|---|---|---|---|---|---|
| 1 | Alborada 9-10 | ABXVR001 | Dahua XVR | 14 | IMOU P2P HLS |
| 2 | Brescia | BRXVR001 | Dahua XVR | 18 | IMOU P2P HLS + HTTP |
| 3 | Danubios Clave | DNXVR001 | Dahua XVR | 9 | IMOU P2P HLS |
| 4 | Hospital S. Jeronimo | HSXVR001 | Dahua XVR | 16 | IMOU P2P HLS |
| 5 | Patio Bonito | PBXVR001 | Dahua XVR | 12 | IMOU P2P HLS |
| 6 | Quintas Sta Maria | QSXVR001 | Dahua XVR | 8 | IMOU P2P HLS |
| 7 | Terrabamba | TBXVR001 | Dahua XVR | 19 | IMOU P2P HLS |
| 8 | Terrazzino | TZXVR001 | Dahua XVR | 18 | IMOU P2P HLS |
| 9 | Pisquines (DVR) | PQDVR001 | Hik DVR | 16 | ISAPI HTTP + hik_pull |
| 10 | Pisquines (NVR) | PQNVR001 | Hik NVR | 16 | hik_pull heartbeat |
| 11 | Senderos | SCDVR001 | Hik DVR | 8 | ISAPI HTTP native |
| 12 | Portalegre | PEDVR001 | Hik DVR | 4 | ISAPI HTTP native |
| 13 | Portal Plaza | PPNVR001 | Hik NVR | 16 | ISAPI HTTP native |
| 14 | Torre Lucia (NVR) | TLNVR001 | Hik NVR | 8 | hik_pull heartbeat |

## Lo que Requiere Accion (9 dispositivos)

### 4 Dahua — Registrar en IMOU Life (sin costo, 10 min cada uno)

| Sitio | Serial | Accion |
|---|---|---|
| Danubios Puesto | AH0306CPAZ5EA1A | Abrir app IMOU Life > Agregar dispositivo > Serial |
| Terrazzino 2 | AH0306CPAZ5E9FA | Mismo procedimiento |
| Santa Ana Cabanas | AB081E4PAZD6D5B | Mismo procedimiento |
| Factory | 9B02D09PAZ4C0D2 | Mismo procedimiento |

**Resultado esperado:** El sistema los detecta automaticamente en 15 minutos. De 14 a 18 operativos.

### 5 Hikvision — Requieren visita tecnica

| Sitio | Problema | Accion |
|---|---|---|
| Torre Lucia (DVR) | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| San Sebastian | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| Altos del Rosario | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| Altagracia (DVR) | Puerto HTTP:80 es del router, no del DVR | Configurar port-forward HTTP:80 al DVR |
| Altagracia (DVR-2) | Sin acceso HTTP | Verificar en sitio |

**Costo estimado:** 1-3 visitas tecnicas ($50-150 por visita)
**Resultado esperado:** De 18 a 23 operativos (100%).

## Valor Entregado

1. **Sistema unificado** que reemplaza el uso paralelo de iVMS-4200 + DSS + IMOU app
2. **14 sitios** visibles en una sola pantalla en https://aionseg.co/vision-hub
3. **Failover automatico** entre rutas de video (IMOU, ISAPI, hik_pull)
4. **Monitoreo 24/7** con health-checks cada 30 segundos
5. **Trazabilidad** completa de eventos y cambios de estado
6. **Sin dependencias externas** costosas (SDKs, iVMS en servidor)

## Cronograma para el 100%

| Dia | Accion | Resultado |
|---|---|---|
| Hoy | Registrar 4 Dahua en IMOU Life | 14 → 18 (78%) |
| Manana | Visita Torre Lucia + San Sebastian | 18 → 20 (87%) |
| Dia 3 | Visita Altos Rosario + Altagracia | 20 → 23 (100%) |
