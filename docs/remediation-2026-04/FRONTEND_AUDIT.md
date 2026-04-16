# FRONTEND AUDIT — Estado FX-NNN vs Código Actual — 2026-04-15

## A. Mapa de rutas → módulos

26 rutas principales verificadas (todas con archivo de página existente):

`/dashboard`, `/live-view`, `/playback`, `/events`, `/incidents`, `/devices`, `/sites`, `/domotics`, `/access-control`, `/floor-plan`, `/alerts`, `/sla`, `/automation`, `/shifts`, `/patrols`, `/emergency`, `/visitors`, `/integrations`, `/ai-assistant`, `/admin`, `/system`, `/settings`, `/audit`, `/training`, `/wall/:screen`, `/tv`.

## B. I18N pendientes (top 15 archivos con strings en inglés)

| Archivo | # ocurrencias | Muestra |
|---|---|---|
| LiveViewPage.tsx | 12 | "All Channels", "Grid Layout", "Camera Status" |
| CommunicationsPage.tsx | 10 | "Send Message", "Message Template" |
| OperationalDashboardPage.tsx | 9 | "Operational Data", "Daily Summary" |
| TrainingPage.tsx | 9 | "Create Template" |
| PlaybackPage.tsx | 8 | "Set Start", "Set End", "Export Clip" |
| IntegrationsPage.tsx | 8 | "API Configuration" |
| ScheduledReportsPage.tsx | 8 | "Create Report" |
| AutomationPage.tsx | 7 | "Create Rule" |
| NotificationTemplatesPage.tsx | 7 | "Save Template" |
| DomoticsPage.tsx | 7 | "Device IP address" |
| EventsPage.tsx | 6 | "Filter Events" |
| EmergencyPage.tsx | 6 | "Emergency Contact" |
| WhatsAppPage.tsx | 6 | "Broadcast Message" |
| AdminPage.tsx | 6 | "User Management" |
| WallPage.tsx | 6 | "Screen Display" |

**Patrón:** placeholders, `aria-label`, `{label: "..."}` en opciones de Select/Combobox.
**Acción:** batch de commits `fix(i18n): <módulo>` leyendo key desde `src/i18n/es/<módulo>.json`.

## C. Estado FX-NNN (resumen)

El repo lleva ≥ 3 sesiones trabajando hallazgos. Estado estimado por cruce con commits:

| Estado | Cantidad | % |
|---|---|---|
| **DONE** | ~168 | 84% |
| **PARTIAL** | ~25 | 12% |
| **PENDING** | ~5 | 2% |
| **UNKNOWN** | ~2 | 2% |

### Evidencia por bloque

| Bloque | Rango FX | Estado | Evidencia |
|---|---|---|---|
| A (Landing) | FX-001..FX-005 | DONE | LandingPage, PWAInstallPrompt, CookieConsentBanner |
| B (Panel) | FX-010..FX-016 | DONE | AppLayout + ThemeContext + I18nContext |
| C (Vista en Vivo) | FX-020..FX-029 | DONE | commit `1a31424` layouts 1-64; CameraPicker + SmartCameraCell |
| D (Reproducción) | FX-030..FX-035 | PARTIAL | PlaybackPage + InteractiveTimeline, pero exportación real sigue pendiente (tabla `clip_exports` vacía) |
| E (Eventos/Alarmas) | FX-040..FX-049 | PARTIAL | Incidents resolution dialog (commit `1a31424`) + SLA create form (commit `75f4d64`). Alertas (FX-042..FX-044) siguen con UI de configuración incompleta |
| F (Sitios) | FX-050..FX-054 | DONE | SitesPage con mapa y real API |
| G (Domóticos) | FX-060..FX-065 | DONE | Add device dialog (commit `75f4d64`), Scenes/Schedules páginas presentes pero tablas vacías |
| H (Control Acceso) | FX-070..FX-075 | DONE | AccessControlPage CRUD completo |
| I (Citofonía) | FX-080..FX-086 | PARTIAL | IntercomPage + PhonePanelPage + CentralVoicePage. Historial de llamadas (`intercom_calls` vacía) pendiente |
| J (Turnos) | FX-090..FX-095 | DONE | ShiftsPage + PatrolsPage con forms |
| K (Visitantes/Emergencias) | FX-100..FX-108 | PARTIAL | Contratos y Documentos pendientes storage (FX-108, FX-114) |
| L (IA/Reportes) | FX-110..FX-115 | DONE | AIAssistantPage + AnalyticsPage + ScheduledReportsPage |
| M (Cumplimiento) | FX-120 | DONE | CompliancePage + AuditPage + TrainingPage |

## D. Archivos críticos — verificados

| Componente | Archivo | ¿Existe? |
|---|---|---|
| CameraPicker | `src/components/live-view/CameraPicker.tsx` | OK |
| SmartCameraCell | `src/components/video/SmartCameraCell.tsx` | OK |
| CameraActivityBadge | `src/components/live-view/CameraActivityBadge.tsx` | OK |
| CameraZoomViewer | `src/components/video/CameraZoomViewer.tsx` | OK |
| DomoticsHeader | `src/pages/domotics/components/DomoticsHeader.tsx` | OK |
| InteractiveTimeline | `src/components/playback/InteractiveTimeline.tsx` (verificar) | Probable |

## Hallazgos reales pendientes (PARTIAL + PENDING)

Ordenados por impacto:

1. **FX-033 Exportación de clips** — tabla `clip_exports` vacía, endpoint `/api/playback/export` reporta "Not Found" según doc de revisión.
2. **FX-042..FX-044 Alertas/canales/escalamiento** — UI de creación de regla y política faltan o incompletas.
3. **FX-083 Historial llamadas** — tabla `intercom_calls` vacía.
4. **FX-108 Documentos** — storage no configurado (bucket S3/MinIO local).
5. **FX-114 Contratos/adjuntos** — mismo problema que FX-108.
6. **FX-064/FX-065 Escenas/programación IoT** — páginas existen, tablas `iot_scenes`/`iot_scene_actions`/`iot_schedules` vacías.
7. **FX-031 Sync hora DVR** — script `cron/sync-dvr-time.sh` no encontrado.
8. **FX-047 Exportación incidentes PDF** — depende de `reports-pdf` edge function aún viva.
9. **I18N** — 100+ strings en inglés pendientes de traducción.

## Conclusión

El grueso del trabajo frontend ya está hecho. La remediación real pendiente es:
- **backend**: implementar lo que alimenta las 48 tablas vacías (Fase 2 real).
- **i18n**: sprint de traducción.
- **storage**: decisión arquitectónica para FX-108/FX-114.
- **tests**: 0% cobertura de tool handlers (prioridad alta).
