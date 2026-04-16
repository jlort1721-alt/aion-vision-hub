#!/usr/bin/env bash
# preflight.sh — Bloque 0 de la sesión 5h AION
# Ejecuta una sola vez antes de pegar PROMPT_ARRANQUE.md en Claude Code

set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"
cd "$REPO_ROOT"

ok() { printf "\033[1;32m✔\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m⚠\033[0m %s\n" "$1"; }
fail() { printf "\033[1;31m✘\033[0m %s\n" "$1"; exit 1; }
info() { printf "\033[1;36m▸\033[0m %s\n" "$1"; }

info "Pre-flight AION 5h — repo: $REPO_ROOT"
echo

# 1. Archivos de contexto presentes
for f in CLAUDE.md AUTORIZACION.md STATE.md PLAN_5H.md PROMPT_ARRANQUE.md .mcp.json; do
  if [[ -f "$f" ]]; then
    ok "$f presente"
  else
    fail "$f ausente — copia desde el kit antes de continuar"
  fi
done
echo

# 2. Variables de entorno
for v in AION_OWNER_PASSWORD ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY; do
  if [[ -n "${!v:-}" ]]; then
    ok "$v cargada (longitud: ${#!v})"
  else
    fail "$v no está exportada — \`export $v='...'\` antes de continuar"
  fi
done
echo

# 3. CLIs instalados
command -v claude >/dev/null && ok "claude CLI: $(claude --version 2>&1 | head -n1)" || fail "claude CLI no instalado"
command -v codex >/dev/null && ok "codex CLI: $(codex --version 2>&1 | head -n1)" || warn "codex CLI no instalado — \`npm i -g @openai/codex\`"
command -v gemini >/dev/null && ok "gemini CLI: $(gemini --version 2>&1 | head -n1)" || warn "gemini CLI no instalado — \`npm i -g @google/gemini-cli\`"
command -v git >/dev/null && ok "git: $(git --version)" || fail "git no instalado"
command -v psql >/dev/null && ok "psql disponible" || warn "psql no disponible localmente (puede usarse desde el VPS)"
command -v node >/dev/null && ok "node: $(node --version)" || fail "node no instalado"
echo

# 4. Repo en estado limpio
if [[ -z "$(git status --porcelain)" ]]; then
  ok "repo en estado limpio"
else
  warn "hay cambios sin commitear — considera commitearlos antes de iniciar"
  git status --short
fi
echo

# 5. Crear estructura de directorios de la sesión
mkdir -p ./session ./audit/{backups,01-baseline,02-plan,03-fixes,04-checkpoints,05-validation,99-final-report}
ok "estructura de directorios ./session/ y ./audit/* creada"

# 6. Crear rama de sesión
BRANCH="session/5h-$(date +%Y%m%d-%H%M)"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  warn "la rama $BRANCH ya existe — no se recrea"
else
  git checkout -b "$BRANCH"
  ok "rama $BRANCH creada"
fi

# 7. Commit inicial del kit
git add CLAUDE.md AUTORIZACION.md STATE.md PLAN_5H.md PROMPT_ARRANQUE.md .mcp.json 2>/dev/null || true
if git diff --cached --quiet; then
  info "no hay cambios para commitear (kit ya estaba commiteado)"
else
  git commit -m "chore(session): inicializa kit de sesión 5h AION"
  ok "commit inicial del kit aplicado"
fi

# 8. Push (best-effort)
git push -u origin HEAD 2>/dev/null && ok "push a origin/$BRANCH" || warn "no se pudo hacer push (revisar remote/credenciales)"

echo
ok "Pre-flight completo. Procede a pegar PROMPT_ARRANQUE.md en Claude Code dentro de Antigravity."
echo "Comando sugerido para abrir el prompt:"
echo "  cat PROMPT_ARRANQUE.md"
