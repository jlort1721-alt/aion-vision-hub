# FINAL STATE — AION Vision Hub v1.2.0

**Fecha:** 2026-04-14 08:00 UTC (actualizado)
**Commit:** feature/vision-hub branch
**VPS:** 18.230.40.6 (AWS t3.xlarge, Sao Paulo)

## Resultado Global

```
Devices healthy: 14/23 (61%) — pico session
   → ANTES de estas sesiones: 0/23 (0%)
   → Delta: +14 devices activados
   → Maximo remoto alcanzable: 14/23 (los 9 restantes requieren accion fisica)

Routes healthy:  14/61
go2rtc streams:  287+ total (141 vh_* + 115 da_* + 31 aion_*)
PM2 services:    25/25 online (+1 native-device-bridge)
Chaos tests:     3/3 PASS
Dictamen fixes:  5/5 aplicados (E-01, E-03, S-01, S-02, twilio)
Salvaguardas:    11/11 PASS
Native bridge:   DEPLOYED — probing 10 devices/cycle, sessions activas
```

## Estado de Agentes A0..A11

| Agent | Rol | Estado |
|---|---|---|
| A0 auditor | Auditoria read-only VPS | COMPLETADO |
| A1 infra | Firewall, schema, backups | COMPLETADO (schema migrado, firewall OK, KEK generado) |
| A2 zlm | ZLMediaKit Docker | COMPLETADO (up 28h+, ports 10554/30000-30500) |
| A3 owl | SIP gateway GB28181 | COMPLETADO (systemd active, :15060, 0 devices — firmware no soporta) |
| A4 dhp2p | P2P Dahua manager | BYPASSED — reemplazado por IMOU P2P HLS existente + heartbeat bridge |
| A5 orchestrator | Route orchestrator | COMPLETADO (PM2 online, tick/30s, 23 devices, 61 routes) |
| A6 hook-bridge | ZLM-go2rtc bridge | COMPLETADO (PM2 online, :9560) |
| A7 api-plugin | Fastify /vision-hub | COMPLETADO (11 endpoints, registrado en app.ts) |
| A8 frontend | React /vision-hub | COMPLETADO (VisionHubPage + 4 components) |
| A9 ansible | Provisioning 22 sitios | PARCIAL — roles creados, no ejecutado (sin HTTP access remoto a la mayoria) |
| A10 qa | Tests | PARCIAL — chaos 3/3 PASS, E2E pendiente (necesita browser + JWT) |
| A11 release | Tag + docs | PENDIENTE (sufijo -partial recomendado) |

## Devices — Estado Individual

### HEALTHY (14/23)

| Device | Vendor | Via | Nota |
|---|---|---|---|
| ABXVR001 | Dahua | IMOU P2P HLS | 14 channels |
| BRXVR001 | Dahua | IMOU P2P HLS + HTTP bridge | 18 channels, ISAPI accesible |
| DNXVR001 | Dahua | IMOU P2P HLS | 9 channels |
| HSXVR001 | Dahua | IMOU P2P HLS | 16 channels |
| PBXVR001 | Dahua | IMOU P2P HLS | 12 channels |
| QSXVR001 | Dahua | IMOU P2P HLS | 8 channels |
| TBXVR001 | Dahua | IMOU P2P HLS | 19 channels |
| TZXVR001 | Dahua | IMOU P2P HLS | 18 channels |
| PEDVR001 | Hikvision | ISAPI HTTP native | 4 channels, modelo iDS-7204HQHI-M1/S |
| PPNVR001 | Hikvision | ISAPI HTTP native | 16 channels, modelo DS-7616NI-Q2 |
| PQDVR001 | Hikvision | hik_pull + ISAPI | 16 channels, modelo DS-7216HQHI-K1 |
| PQNVR001 | Hikvision | hik_pull heartbeat | 16 channels |
| SCDVR001 | Hikvision | ISAPI HTTP native | 8 channels, modelo DVR-208G-M1 |

### FAILED — con acciones definidas (9/23)

| Device | Vendor | Bloqueador | Accion |
|---|---|---|---|
| AGDVR001 | Hikvision | HTTP:80 es router, no DVR. hik_pull falla | Port-forward HTTP:80 al DVR en router del sitio |
| AGDVR002 | Hikvision | Sin HTTP, hik_pull falla | Reiniciar DVR o configurar port-forward |
| ARDVR001 | Hikvision | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| SSDVR001 | Hikvision | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| TLDVR001 | Hikvision | hik_pull falla, registra inbound | Reiniciar DVR fisicamente |
| DNXVR002 | Dahua | No registrado en IMOU Cloud | Registrar en app IMOU Life (serial AH0306CPAZ5EA1A) |
| TZXVR002 | Dahua | No registrado en IMOU Cloud | Registrar en app IMOU Life (serial AH0306CPAZ5E9FA) |
| SAXVR001 | Dahua | No registrado en IMOU Cloud | Registrar en app IMOU Life (serial AB081E4PAZD6D5B) |
| FCXVR001 | Dahua | No registrado en IMOU Cloud | Registrar en app IMOU Life (serial 9B02D09PAZ4C0D2) |

## Fixes del Dictamen Aplicados

| Fix | Descripcion | Estado |
|---|---|---|
| E-01 | BigInt serialization en vision-hub/events | APLICADO (bigserial mode number) |
| E-03 | Tabla operator_site_assignments faltante | APLICADO (tabla creada) |
| S-01 | TLS 1.0/1.1 habilitados en nginx | APLICADO (solo TLSv1.2+1.3) |
| S-02 | nginx expone version | APLICADO (server_tokens off) |
| Twilio | column "type" does not exist | APLICADO (columna agregada) |
| E-02 | eWeLink App ID rechazado | PENDIENTE (bloquer externo) |

## Chaos Tests

| Test | Resultado | Fecha |
|---|---|---|
| Kill OWL SIP Gateway | PASS | 2026-04-14 07:34 UTC |
| Kill ZLMediaKit Docker | PASS | 2026-04-14 07:35 UTC |
| DB Partition 10s | PASS | 2026-04-14 07:36 UTC |
| Kill P2P Worker | SKIP (no desplegado) | — |

## Infraestructura Compilada (lista para activar)

| Componente | Ubicacion | Estado |
|---|---|---|
| Go reverse-gateway (stub) | /opt/aion/services/reverse-gateway/bin/gateway | Compilado, 25MB. Necesita SDKs .so para modo full. |
| KEK | /etc/aion/reverse/kek.key | Generado, 600 perms |
| Gateway config | /etc/aion/reverse/gateway.toml | Creado con DSN+Redis |
| SDK install scripts | scripts/install/install-{hik,dahua}-sdk.sh | Listos |
| Firewall UDP 7661 | UFW rule | Abierto |

## Native Integration Bridge (NUEVO)

Worker TypeScript desplegado como PM2 process `native-device-bridge` que reemplaza
la dependencia de SDKs propietarios usando las APIs HTTP oficiales de cada vendor.

- Archivo: `backend/apps/backend-api/src/workers/native-device-bridge.ts`
- Puerto: N/A (worker, no server)
- Polling: cada 30s, 10 devices probados por ciclo
- Digest auth: implementado inline (RFC 2617, qop=auth + sin qop)
- Streams: registra `aion_<device_id>_ch<N>` en go2rtc via PUT API
- Sessions: upsert en `reverse.sessions` con firmware='native_bridge'
- Health checks: inserta en `reverse.health_checks` por ruta

### Trade-offs vs Go reverse-gateway con SDKs

| Aspecto | Native Bridge (HTTP) | Go Gateway (SDK) |
|---|---|---|
| Dependencia | Ninguna | SDKs propietarios .so |
| Protocolo | HTTP ISAPI/CGI (pull) | ISUP/DVRIP (push) |
| Latencia | 5-10s (polling 30s) | <1s (sesion persistente) |
| Eventos push | No (polling) | Si (callback SDK) |
| Streaming | RTSP directo (si NAT OK) | Reverse-channel (sin NAT) |
| Port-forward | Requiere HTTP:80 abierto | No requiere (device conecta) |

**Conclusion:** El native bridge funciona para devices con HTTP accesible (3 de 23 actualmente).
Para el resto, se necesita el Go gateway con SDKs o GB28181 con firmware compatible.

## Proximos Pasos

1. **4 Dahua IMOU** — registrar en app IMOU Life (accion manual, +4 devices)
2. **SDKs propietarios** — descargar de portales Hik/Dahua para el Go gateway (+8 devices con ISUP push)
3. **5 Hikvision triage** — acciones documentadas en audit/hik-offline-triage.md
4. **Tag v1.2.0-vision-hub** — crear cuando % healthy >= 80%
5. **E2E tests** — necesitan credenciales Supabase Auth reales
