# AION Vision Hub — Próximos Pasos de Implementación

> **Auditor:** CTO / QA Lead Principal
> **Fecha:** 2026-03-08
> **Criterio:** Pasos ordenados por dependencia real, no por optimismo. Cada fase tiene prerequisitos claros.

---

## Fase 0: Hardening de Seguridad (INMEDIATO — antes de cualquier otro trabajo)

**Prerequisito:** Acceso a Supabase Dashboard y edge functions.
**Entregable:** Todas las 11 edge functions con CORS restringido y rate limiting básico.

1. **Restringir CORS en las 11 edge functions**
   - Cambiar `Access-Control-Allow-Origin: *` por el dominio real del frontend
   - Archivos: todas las funciones en `supabase/functions/*/index.ts`
   - Esfuerzo: 1-2 horas

2. **Agregar rate limiting básico**
   - Implementar rate limit por IP y por user_id (ej: 60 req/min general, 10 req/min para AI)
   - Opción: Supabase Edge Function con KV store, o header-based con Cloudflare
   - Esfuerzo: 4-8 horas

3. **Corregir tenant isolation en health-api y reports-pdf**
   - health-api: filtrar queries por tenant_id del usuario autenticado
   - reports-pdf: idem, agregar `WHERE tenant_id = get_user_tenant_id()`
   - Esfuerzo: 2-4 horas

4. **Securizar event-alerts**
   - Requerir autenticación o API key interna para POST
   - Filtrar usuarios por tenant_id al construir lista de destinatarios
   - Esfuerzo: 2-3 horas

5. **Configurar password policy en Supabase**
   - Minimum 12 chars con al menos 1 mayúscula, 1 número, 1 especial
   - Supabase Dashboard > Auth > Settings > Password
   - Esfuerzo: 30 minutos

6. **Agregar CSP meta tag**
   - En `index.html`: `<meta http-equiv="Content-Security-Policy" content="...">`
   - Esfuerzo: 1 hora

---

## Fase 1: PWA Funcional (Semana 1)

**Prerequisito:** Fase 0 completada.
**Entregable:** App instalable desde Chrome/Edge/Safari con íconos correctos.

1. **Instalar vite-plugin-pwa**
   - `npm install -D vite-plugin-pwa`
   - Configurar en `vite.config.ts` con workbox
   - Esfuerzo: 2-4 horas

2. **Generar íconos PWA**
   - 192x192 y 512x512 PNG desde logo
   - Actualizar `manifest.json` con array de íconos
   - Esfuerzo: 1 hora

3. **Registrar service worker**
   - Auto-registrado por vite-plugin-pwa en `main.tsx`
   - Estrategia: NetworkFirst para API, CacheFirst para assets
   - Esfuerzo: incluido en paso 1

4. **Verificar install prompt**
   - Probar en Chrome DevTools > Application > Manifest
   - Lighthouse audit > PWA score
   - Esfuerzo: 1 hora

---

## Fase 2: Email Real + ElevenLabs (Semanas 1-2)

**Prerequisito:** Fase 0 completada. API keys de Resend/SendGrid y ElevenLabs.
**Entregable:** Emails de alerta se envían realmente. TTS funciona en citofonía.

1. **Integrar Resend/SendGrid en event-alerts**
   - Reemplazar el log simulado por llamada HTTP al proveedor
   - Agregar env var `RESEND_API_KEY` o `SENDGRID_API_KEY`
   - Agregar botón "Enviar evidencia por correo" en EventDetailPanel
   - Esfuerzo: 4-8 horas

2. **Crear edge function elevenlabs-tts**
   - Nueva función en `supabase/functions/elevenlabs-tts/index.ts`
   - Endpoints: POST /synthesize (text → audio), GET /voices (listar voces)
   - Agregar env var `ELEVENLABS_API_KEY`
   - Agregar contract en production-contracts.ts
   - Esfuerzo: 8-12 horas

3. **Conectar IntercomPage con elevenlabs-tts**
   - Voice AI config guarda configuración funcional
   - Preview de voz con botón play
   - Esfuerzo: 4-6 horas

---

## Fase 3: Video Gateway (Semanas 2-6)

**Prerequisito:** Hardware de cámaras disponible. Red configurada.
**Entregable:** Video en vivo y playback funcional en el browser.

**NOTA:** Este es el componente más complejo. No existe código de gateway en el repositorio actual. Los archivos `production-contracts.ts` y `adapters.ts` definen las interfaces pero la implementación es from-scratch.

1. **Proyecto gateway separado**
   - Crear repositorio `aion-edge-gateway`
   - Stack recomendado: Node.js/Go + MediaMTX para RTSP→WebRTC
   - Docker container para deploy on-premise
   - Esfuerzo: 2-4 semanas

2. **Implementar adapters de dispositivos**
   - HikvisionAdapter: ISAPI + RTSP
   - DahuaAdapter: HTTP API + RTSP
   - OnvifAdapter: ONVIF Profile S
   - Seguir interfaces de `adapters.ts`
   - Esfuerzo: 1-2 semanas por adapter

3. **Player de video en frontend**
   - Agregar HLS.js o WebRTC client en LiveViewPage
   - Reemplazar placeholders por `<video>` elements reales
   - Signed URLs con TTL de 5 minutos
   - Esfuerzo: 1-2 semanas

4. **Playback desde NVR**
   - Gateway extrae recordings del NVR via SDK/API
   - Transcoding H.265→H.264 si necesario
   - Reemplazar mock segments por data real
   - Esfuerzo: 1-2 semanas

5. **ONVIF discovery**
   - Scan de red para auto-detectar cámaras
   - Botón "Discover Devices" en DevicesPage
   - Esfuerzo: 3-5 días

---

## Fase 4: Comunicaciones (Semanas 4-8)

**Prerequisito:** Aprobación Meta para WhatsApp Business API. PBX/SIP trunk disponible.
**Entregable:** WhatsApp alerts y SIP calls funcionales.

1. **WhatsApp Business API**
   - Crear edge function `whatsapp-api`
   - Integrar con Meta Cloud API
   - UI para enviar evidencia (snapshot + texto) via WhatsApp
   - Template messages para alertas
   - Esfuerzo: 2-3 semanas (incluye proceso de aprobación Meta)

2. **SIP/VoIP gateway**
   - Integrar con PBX (Asterisk/FreePBX)
   - SIP.js o WebRTC para llamadas desde browser
   - Reemplazar toast placeholders en IntercomPage
   - Esfuerzo: 2-3 semanas

3. **eWeLink/Sonoff integration**
   - Edge function para API eWeLink
   - Toggle real de dispositivos domóticos
   - Esfuerzo: 1 semana

---

## Fase 5: Hardening y Calidad (Semanas 6-10)

**Prerequisito:** Fases 0-3 completadas.
**Entregable:** Plataforma hardened, testeable, monitoreable.

1. **2FA real con TOTP**
   - Supabase MFA o librería TOTP
   - QR code enrollment
   - Enforcement para roles admin
   - Esfuerzo: 1-2 semanas

2. **AI improvements**
   - Persistencia de conversaciones (restaurar desde ai_sessions)
   - Tool calling funcional (ejecutar acciones via AION)
   - AION embebido como copilot en módulos
   - Esfuerzo: 2-3 semanas

3. **Test suite**
   - Unit tests para hooks y services
   - Integration tests para edge functions
   - E2E con Playwright para flujos críticos
   - Esfuerzo: 2-3 semanas

4. **Monitoring**
   - Prometheus/Grafana para métricas
   - Error tracking (Sentry)
   - Esfuerzo: 1 semana

5. **Code splitting**
   - Lazy loading de rutas
   - Reducir bundle inicial de 1.9MB a < 500KB
   - Esfuerzo: 2-3 días

---

## Dependencias Críticas por Fase

```
Fase 0 (Seguridad)     → Sin dependencia externa
Fase 1 (PWA)           → Sin dependencia externa
Fase 2 (Email/TTS)     → API keys (Resend + ElevenLabs)
Fase 3 (Video)         → Hardware de cámaras + red local + MediaMTX
Fase 4 (Comunicaciones) → Meta approval + PBX + eWeLink credentials
Fase 5 (Hardening)      → Fases anteriores completadas
```

---

## Timeline Realista

| Fase | Duración | Personas | Bloqueante |
|------|----------|----------|------------|
| 0: Seguridad | 2-3 días | 1 backend dev | Ninguno |
| 1: PWA | 1-2 días | 1 frontend dev | Ninguno |
| 2: Email/TTS | 1-2 semanas | 1 backend dev | API keys |
| 3: Video Gateway | 4-6 semanas | 2 devs (1 backend + 1 frontend) | Hardware + MediaMTX |
| 4: Comunicaciones | 3-4 semanas | 1-2 devs | Meta approval, PBX |
| 5: Hardening | 3-4 semanas | 2 devs | Fases 0-3 |

**Total estimado:** 12-18 semanas con 2 desarrolladores dedicados.

**Ruta crítica:** Fase 0 → Fase 3 (Video Gateway) es el camino más largo y el que desbloquea la funcionalidad principal de la plataforma.
