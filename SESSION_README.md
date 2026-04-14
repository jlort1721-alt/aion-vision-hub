# AION Session Kit — Sesión 5h en Antigravity con Claude + Codex + Gemini

Kit completo para una sesión continua de cinco horas de remediación, validación y certificación de la plataforma AION (`aionseg.co`), orquestada por Claude Code en Antigravity con Codex y Gemini como segundo y tercer par de ojos.

## Contenido del kit

| Archivo | Propósito |
|---|---|
| `CLAUDE.md` | Contexto operativo de AION (stack, módulos, integraciones, paleta, blockers, criterios). Se carga automáticamente en cada sesión Claude Code. |
| `AUTORIZACION.md` | Autorización formal de la propietaria para todas las acciones autónomas. |
| `STATE.md` | Memoria persistente entre bloques. Se actualiza cada 30 min. |
| `PLAN_5H.md` | Plan operativo de los 5 bloques (300 min): pre-flight, baseline, plan consensuado, remediación intensiva, validación, cierre. |
| `PROMPT_ARRANQUE.md` | Prompt único que se pega en Claude Code dentro de Antigravity para iniciar la sesión. |
| `.mcp.json` | Configuración MCP para exponer Codex y Gemini como herramientas dentro de Claude Code. |
| `preflight.sh` | Script de verificación previa (Bloque 0). |

## Pre-requisitos

- Cuenta Anthropic con Claude Code CLI (idealmente plan Max para no toparse con límites en 5h continuas).
- Cuenta OpenAI con `OPENAI_API_KEY` para Codex.
- Cuenta Google AI con `GEMINI_API_KEY` para Gemini.
- Acceso SSH al VPS de AION + permisos de escritura en el repositorio.
- Antigravity instalado (https://antigravity.dev o equivalente actual).
- Node.js ≥20.

## Uso paso a paso

### 1. Copiar el kit a la raíz del repo

```bash
cp -r aion-session-kit/* aion-session-kit/.mcp.json /ruta/a/repo-aion/
cd /ruta/a/repo-aion
```

### 2. Exportar variables de entorno

```bash
export AION_OWNER_PASSWORD='Jml1413031'   # rotar al cierre
export ANTHROPIC_API_KEY='sk-ant-...'
export OPENAI_API_KEY='sk-...'
export GEMINI_API_KEY='...'
```

### 3. Instalar CLIs auxiliares

```bash
npm i -g @openai/codex @google/gemini-cli
codex --version && gemini --version && claude --version
```

### 4. Ejecutar pre-flight

```bash
bash preflight.sh
```

El script verifica archivos, variables, CLIs, estado del repo, crea la rama de sesión y aplica el commit inicial del kit.

### 5. Abrir Antigravity en el repo

Abre Antigravity con el repo cargado. Asegúrate de que `.mcp.json` esté reconocido (los servidores `codex` y `gemini` deben aparecer disponibles).

### 6. Pegar el prompt de arranque

```bash
cat PROMPT_ARRANQUE.md
```

Copia el contenido completo y pégalo como **primer mensaje** en la sesión de Claude Code dentro de Antigravity.

### 7. Dejar correr 5 horas

Claude responderá con el mensaje de inicio y arrancará el Bloque 1. Las 5 horas se ejecutan de forma autónoma. Puedes revisar avance sin interrumpir abriendo `STATE.md` y `./audit/PROGRESO.md`.

### 8. Cierre

Al cerrar el Bloque 5, Claude emitirá:
- `./audit/05-validation/DICTAMEN_AION_v<N>.pdf` (resultado binario)
- `./audit/99-final-report/INFORME_SESION.md`
- `./audit/99-final-report/ROTACION_CREDENCIALES.md`
- Tag `cert-v<N>-<fecha>` en git

**Acción humana inmediata:** rotar contraseña de `jlort1721@gmail.com` y los tokens API tocados (instrucciones en `ROTACION_CREDENCIALES.md`).

## Qué garantiza el kit

- Contexto completo cargado desde el primer mensaje (sin gastar mensajes redescubriendo).
- Tres modelos revisando los puntos críticos (reduce ceguera de modelo único).
- Commits atómicos + tags por hora (rollback granular si una iteración tardía rompe algo).
- Memoria persistente externa (`STATE.md`) que sobrevive a interrupciones de sesión.
- Validación final empírica con evidencia reproducible.
- Documentación honesta de blockers externos no resueltos.

## Qué no garantiza

- Blockers externos (eWeLink App ID, Asterisk peers, GB28181, dh-p2p-manager) requieren acción humana con acceso a portales o dispositivos físicos. Si no se resuelven, el dictamen será "APTO CON OBSERVACIONES".
- Integraciones físicas con dispositivos apagados quedan como `NO VERIFICADO` documentado.
- Cambios de arquitectura grandes no caben en 5h con calidad.

## Riesgo principal y mitigación

El riesgo real no es que Claude se canse, es que el contexto se sature y empiece a alucinar fixes a las 4 horas. Mitigaciones aplicadas:
- `/compact` cada 30 min.
- `STATE.md` como memoria externa persistente.
- Commits frecuentes + tag de checkpoint cada hora.
- Checkpoint Gemini al minuto 120 para detectar regresiones que Claude no haya visto.

## Reanudación tras interrupción

Si Antigravity se cae, el límite del plan se topa, o cualquier otra interrupción ocurre:

```bash
cd /ruta/a/repo-aion
git pull
cat STATE.md   # ver dónde quedó
```

Reanudar pegando este prompt corto:

> Sesión 5h AION reanudada. Lee `STATE.md`, identifica el último bloque cerrado, continúa desde el siguiente bloque del `PLAN_5H.md`. Mantén las mismas reglas. Confirma con un mensaje breve qué bloque retomas y empieza.
