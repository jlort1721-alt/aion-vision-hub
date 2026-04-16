# PLAN_5H.md — Sesión de remediación AION (300 minutos)

> Plan operativo. Cada bloque tiene objetivo, prompt, salidas esperadas y check de cierre. Si un bloque termina antes, pasa al siguiente. Si se atrasa, recorta scope pero **nunca omite el commit + push + actualización de STATE.md**.

---

## Bloque 0 — Pre-flight (15 min, fuera del cronómetro)

**Objetivo:** entorno listo, credenciales en variables de entorno, MCP funcionando.

```bash
# Verificaciones
cd <repo-aion>
test -f CLAUDE.md && test -f AUTORIZACION.md && test -f STATE.md && test -f .mcp.json
echo $AION_OWNER_PASSWORD | head -c 3   # debe imprimir 3 caracteres
echo $ANTHROPIC_API_KEY | head -c 6
echo $OPENAI_API_KEY | head -c 6
echo $GEMINI_API_KEY | head -c 6
codex --version && gemini --version && claude --version

mkdir -p ./session ./audit/{backups,01-baseline,02-plan,03-fixes,04-checkpoints,05-validation,99-final-report}
git checkout -b session/5h-$(date +%Y%m%d-%H%M)
git add CLAUDE.md AUTORIZACION.md STATE.md PLAN_5H.md .mcp.json
git commit -m "chore(session): inicializa kit de sesión 5h"
git push -u origin HEAD
```

**Check de cierre Bloque 0:** los 4 archivos de contexto presentes + variables de entorno cargadas + rama creada.

---

## Bloque 1 — Reconocimiento y línea base (30 min)

**Objetivo:** radiografía empírica del estado actual, sin reparar.

**Prompt para Claude Code:**
> Lee `CLAUDE.md` completo. Lee el último dictamen (`./revalidation/10-dictamen/` o el más reciente). Genera `./audit/01-baseline/baseline.md` con: estado real verificado de los 24 PM2, 7 systemd, Docker, nginx, Postgres, Redis, MQTT, Asterisk; conteos por las 164 tablas críticas; resultado de smoke test contra los 48 endpoints conocidos con JWT real; estado de los 241 streams en go2rtc (muestra estratificada de 30); estado de los 4 blockers externos. **Cero reparaciones en este bloque.** Solo evidencia. Al cerrar, actualiza `STATE.md` con la lista de hallazgos abiertos por severidad.

**Salidas:** `./audit/01-baseline/baseline.md` + commit + STATE.md actualizado.

**Check de cierre:** `STATE.md` muestra ≥1 hallazgo o "0 hallazgos" justificado con evidencia.

---

## Bloque 2 — Plan de ataque consensuado (20 min)

**Objetivo:** plan único priorizado, validado por los 3 modelos.

**Prompt para Claude Code:**
> Con base en `./audit/01-baseline/baseline.md`, genera `./audit/02-plan/plan-borrador.md` con todos los hallazgos ordenados por severidad (bloqueante → alta → media → baja) y por dependencia (los que desbloquean otros primero). Para cada hallazgo: causa raíz hipotética, fix propuesto en una línea, módulo afectado, riesgo de regresión, tiempo estimado.
>
> Luego invoca:
> ```bash
> codex exec "revisa ./audit/02-plan/plan-borrador.md y señala riesgos técnicos, fixes alternativos más robustos, dependencias ocultas. Responde en markdown estructurado." > ./audit/02-plan/codex-review.md
> gemini -p "lee ./CLAUDE.md y ./audit/02-plan/plan-borrador.md. Señala omisiones de contexto, módulos del CLAUDE.md no cubiertos, criterios de aceptación que el plan no atiende. Responde en markdown estructurado." > ./audit/02-plan/gemini-review.md
> ```
> Sintetiza las 3 visiones en `./audit/02-plan/PLAN_FINAL.md` con orden definitivo de ejecución, marcando explícitamente los puntos donde Codex o Gemini aportaron algo que tú no habías visto. Commit + push + actualizar STATE.md.

**Salidas:** `PLAN_FINAL.md` + 2 reviews + commit.

**Check de cierre:** plan final tiene N tareas ordenadas, cada una con fix, módulo, severidad, tiempo.

---

## Bloque 3 — Remediación intensiva (180 min, en sub-bloques de 30)

**Objetivo:** cerrar todos los hallazgos no externos. Loop de 6 sub-bloques.

**Prompt base (válido para cada sub-bloque):**
> Toma del `PLAN_FINAL.md` los próximos 1–3 hallazgos de mayor severidad pendientes. Para cada uno:
> 1. Crear rama `fix/<modulo>-<slug>`.
> 2. Backup si toca BD o config (`./audit/backups/<timestamp>/`).
> 3. Escribir test que reproduzca el bug y falle.
> 4. Implementar fix en causa raíz.
> 5. Para fixes críticos o ambiguos: `codex exec "revisa este diff <git diff HEAD~1>, ¿hay un enfoque más robusto o un edge case no cubierto?"` antes del commit.
> 6. Re-ejecutar el test del paso 3 (debe pasar) + suite del módulo (sin regresiones).
> 7. Commit atómico: `fix(<modulo>): <desc> — cierra <ID> [— co-revisado: codex]`.
> 8. Merge a la rama de sesión.
>
> Al cerrar el sub-bloque (30 min): `git push`, actualiza `STATE.md` (módulos cambiados de estado, hallazgos cerrados, hallazgos nuevos detectados), agrega línea a `./audit/PROGRESO.md`, ejecuta `/compact` para liberar contexto.

### Sub-bloques

| Sub-bloque | Minutos | Foco principal sugerido |
|---|---|---|
| 3.1 | 0–30 | Bloqueantes pendientes + backend (endpoints 5xx, RBAC, validaciones) |
| 3.2 | 30–60 | UI altos: módulos con error al entrar (Programación, Reinicios, Puestos, Minuta, Documentos) |
| 3.3 | 60–90 | Vista en Vivo + Reproducción (árbol, fullscreen, timestamp, exportación, 64 layouts) |
| 3.4 | 90–120 | **CHECKPOINT GEMINI** + Eventos/Alertas/Incidentes/Detecciones |
| 3.5 | 120–150 | Turnos/Asignaciones/Calendario (constraints SQL + flujos) + Domóticos + Control Acceso |
| 3.6 | 150–180 | Comunicaciones, Asistente IA, Analíticas, Reportes, Notas, Contratos, Llaves, Cumplimiento, Capacitación + i18n + paleta |

**Checkpoint Gemini (al final del sub-bloque 3.4, ~minuto 120):**
```bash
gemini -p "lee los últimos 30 commits con git log -p HEAD~30. Busca: regresiones, fugas de seguridad, breaking changes, secretos commiteados, tests deshabilitados, manejo de errores ausente, console.log dejados, TODOs nuevos, datos hardcoded introducidos. Responde con tabla: hallazgo | severidad | commit | recomendación." > ./audit/04-checkpoints/checkpoint-2h.md
```
Si Gemini detecta algo: agregar a `PLAN_FINAL.md` y atender en sub-bloques restantes.

**Check de cierre Bloque 3:** STATE.md con ≥80% de hallazgos cerrados o documentación de por qué no.

---

## Bloque 4 — Validación final completa (45 min)

**Objetivo:** dictamen empírico tras todas las reparaciones.

**Prompt para Claude Code:**
> Ejecuta validación completa siguiendo el patrón del prompt de re-validación previo. Las 8 fases:
> 1. **Infraestructura** — PM2, systemd, Docker, nginx, postgres, redis, mqtt, asterisk.
> 2. **Backend** — los endpoints conocidos + nuevos, con JWT real de los 4 roles, caminos de error.
> 3. **Frontend Playwright** — los 41 módulos con login real (storageState desde `AION_OWNER_PASSWORD`), 12 tests mínimos por módulo (carga, handlers, persistencia, BD vs hardcoded, cero inglés, cero errores consola, RBAC, layout 1366/1920/2560, caminos de error).
> 4. **Datos** — conteos, FKs sin huérfanos, audit_log activo, backup restaurable.
> 5. **Seguridad** — testssl.sh, headers, RBAC matrix, JWT edge cases, secretos, ZAP baseline.
> 6. **Integraciones físicas** — Hikvision (3 cámaras, snapshot+clip), Dahua (2 dispositivos), eWeLink (real o degradación elegante), Asterisk (si peers configurados), MQTT, Twilio (1 WA + 1 SMS + 1 voz), n8n, Streams go2rtc (muestra de 30).
> 7. **Performance** — Lighthouse 10 rutas (Perf ≥85, A11y ≥95), axe sin críticos/serios, k6 con 20 vUsers / 3 min (p95 <1s, errores <0.5%), resiliencia (kill PM2, restart Postgres).
> 8. **Dictamen** — `./audit/05-validation/DICTAMEN_AION_v<N>.md` + `.pdf` con resultado binario, matriz 41 módulos × 8 fases, hallazgos nuevos, comparación contra baseline del Bloque 1, blockers externos persistentes, recomendación final, firma criptográfica (SHA-256 del directorio evidencia).
>
> Si el dictamen es **CERTIFICADO 100%** → pasar a Bloque 5.
> Si **NO CERTIFICADO** → iterar: regresar al loop del Bloque 3 con los hallazgos nuevos durante el tiempo restante, luego re-ejecutar Bloque 4.

**Check de cierre:** dictamen emitido con resultado binario + matriz completa.

---

## Bloque 5 — Cierre y entrega (10 min)

**Objetivo:** archivar, etiquetar, instruir rotación de claves.

**Prompt para Claude Code:**
> 1. Eliminar los 4 usuarios efímeros de auditoría (`audit_*@aion.test`) de la BD.
> 2. Invalidar tokens/sesiones generados durante la sesión.
> 3. Generar `./audit/99-final-report/INFORME_SESION.md` con: hallazgos cerrados (lista), commits aplicados (cantidad + hash inicial y final), métricas antes/después (Lighthouse, axe, latencias, conteos), blockers externos persistentes con su acción humana exacta, próximos pasos sugeridos.
> 4. Generar `./audit/99-final-report/ROTACION_CREDENCIALES.md` con instrucciones para que la propietaria rote la contraseña de `jlort1721@gmail.com` y los tokens API que se hayan tocado.
> 5. `git add -A && git commit -m "chore(session): cierre sesión 5h — certificado v<N>"`
> 6. `git tag cert-v<N>-$(date +%Y%m%d) && git push --tags`
> 7. Mensaje final al usuario con el formato:
>
> ```
> SESIÓN COMPLETADA.
> Duración: <X>h <Y>min
> Iteraciones del loop: <N>
> Hallazgos cerrados: <N>
> Commits aplicados: <N>
> Módulos certificados: <N>/41
> Integraciones físicas verificadas: <lista>
> Blockers externos persistentes: <lista con acción humana>
> Resultado dictamen: <CERTIFICADO 100% | APTO CON OBSERVACIONES | NO APTO>
> Tag: cert-v<N>-<fecha>
> Certificado: ./audit/05-validation/DICTAMEN_AION_v<N>.pdf
>
> ACCIÓN REQUERIDA:
> 1. Rotar contraseña de jlort1721@gmail.com (ver ROTACION_CREDENCIALES.md)
> 2. Resolver blockers externos pendientes
> 3. Re-validar tras cada blocker resuelto con: <comando>
> ```

---

## Reglas transversales

- **Cada commit ≤ 200 LOC cambiadas** (excepto migraciones / seeds masivos).
- **Cada `git push` ≤ cada 30 min.**
- **`/compact` cada 30 min** para preservar contexto.
- **Tag de checkpoint cada hora** (`session-h1`, `session-h2`, …) para rollback granular si una iteración tardía rompe algo.
- Si Antigravity se cae: reanudar con `git pull` + leer `STATE.md` + continuar desde el bloque anotado.
- Si se topa con límite de mensajes/tokens del plan: hacer `/compact`, guardar el progreso, esperar reset; al volver, leer `STATE.md` y continuar.
