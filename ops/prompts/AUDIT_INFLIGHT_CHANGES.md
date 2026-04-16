# 🔍 PROMPT — AUDITORIA DE CAMBIOS EN EL AIRE

Ejecuta este prompt **antes de cualquier deploy** cuando sospeches que Claude CLI/Antigravity ha generado cambios que no se reflejan en el estado desplegado. Su unico proposito es **reconciliar el estado real del disco contra git, PM2, nginx, Docker y la base de datos**.

---

## REGLAS

1. Todas las ordenes son **read-only** excepto los commits finales que tu autorizas explicitamente (`--commit-clean`).
2. El reporte debe listar **cada archivo tocado** con su hash, autor y fecha. Sin agregados vagos.
3. Si un cambio no tiene proposito identificable en ~30s de analisis → marcado como `ABANDONED` y propuesto para descarte.

---

## EJECUTAR

```bash
set -euo pipefail
AUDIT_DIR="/opt/aion/snapshots/audit-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"
REPORT="$AUDIT_DIR/REPORT.md"

echo "# AION — Auditoria de cambios en el aire" > "$REPORT"
echo "Generado: $(date -Is)" >> "$REPORT"
echo "" >> "$REPORT"

# ============================================================================
# 1) GIT — todos los repos del monorepo
# ============================================================================
echo "## 1. Estado Git por repo" >> "$REPORT"
REPOS=(api frontend agent model-router vision-hub comms worker scheduler tests ops db qa)
for r in "${REPOS[@]}"; do
  DIR="/opt/aion/$r"
  [[ -d "$DIR/.git" ]] || continue
  echo "" >> "$REPORT"
  echo "### \`$r\`" >> "$REPORT"

  cd "$DIR"

  echo "" >> "$REPORT"
  echo "**Branch:** \`$(git rev-parse --abbrev-ref HEAD)\`  " >> "$REPORT"
  echo "**HEAD:** \`$(git rev-parse --short HEAD)\`  " >> "$REPORT"
  echo "**Upstream diff:** \`$(git rev-list --count HEAD ^origin/main 2>/dev/null || echo '?')\` commits ahead, \`$(git rev-list --count origin/main ^HEAD 2>/dev/null || echo '?')\` behind" >> "$REPORT"
  echo "" >> "$REPORT"

  # Archivos modificados / untracked
  WORKING="$(git status --short)"
  if [[ -n "$WORKING" ]]; then
    echo "#### Working tree dirty:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$WORKING" >> "$REPORT"
    echo '```' >> "$REPORT"

    # Guarda el diff completo
    git diff > "$AUDIT_DIR/$r.working.diff"
    git diff --cached > "$AUDIT_DIR/$r.staged.diff"
  fi

  # Commits locales no pushed
  UNPUSHED="$(git log --oneline @{u}..HEAD 2>/dev/null || echo '')"
  if [[ -n "$UNPUSHED" ]]; then
    echo "#### Commits locales sin push:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$UNPUSHED" >> "$REPORT"
    echo '```' >> "$REPORT"
  fi

  # Stashes
  STASHES="$(git stash list)"
  if [[ -n "$STASHES" ]]; then
    echo "#### Stashes:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$STASHES" >> "$REPORT"
    echo '```' >> "$REPORT"
    git stash list --format='%gd %ci %s' > "$AUDIT_DIR/$r.stashes.txt"
  fi

  # Branches locales no mergeadas
  DEAD_BRANCHES="$(git branch --no-merged main 2>/dev/null | grep -v '^\*' || true)"
  if [[ -n "$DEAD_BRANCHES" ]]; then
    echo "#### Branches locales no mergeadas a main:" >> "$REPORT"
    echo '```' >> "$REPORT"
    echo "$DEAD_BRANCHES" >> "$REPORT"
    echo '```' >> "$REPORT"
  fi
done

# ============================================================================
# 2) Archivos modificados fuera de git (infra, configs)
# ============================================================================
echo "" >> "$REPORT"
echo "## 2. Infra modificada fuera de git" >> "$REPORT"

echo "### /etc/nginx (modificados en ultimas 14 dias)" >> "$REPORT"
echo '```' >> "$REPORT"
sudo find /etc/nginx -type f -mtime -14 -printf '%TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null \
  | sort >> "$REPORT" || true
echo '```' >> "$REPORT"

echo "### PM2 ecosystem runtime (vs archivo)" >> "$REPORT"
echo '```' >> "$REPORT"
pm2 jlist | jq -r '.[] | "\(.name)\t\(.pm2_env.status)\t\(.pm2_env.exec_mode)\t\(.pm2_env.instances // 1)"' >> "$REPORT"
echo '```' >> "$REPORT"

echo "### Archivos .draft / .wip / .local / .bak" >> "$REPORT"
echo '```' >> "$REPORT"
sudo find /opt/aion -type f \( -name "*.draft" -o -name "*.wip" -o -name "*.local" -o -name "*.bak" \) \
  -not -path "*/node_modules/*" -printf '%TY-%Tm-%Td  %p\n' 2>/dev/null | sort >> "$REPORT"
echo '```' >> "$REPORT"

# ============================================================================
# 3) Docker — contenedores fuera de compose
# ============================================================================
echo "" >> "$REPORT"
echo "## 3. Contenedores Docker" >> "$REPORT"
echo '```' >> "$REPORT"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Label "com.docker.compose.project"}}' \
  >> "$REPORT"
echo '```' >> "$REPORT"

# ============================================================================
# 4) DB — migraciones pendientes, tablas sin RLS
# ============================================================================
echo "" >> "$REPORT"
echo "## 4. Base de datos PostgreSQL" >> "$REPORT"

echo "### Ultimas 10 migraciones aplicadas" >> "$REPORT"
echo '```' >> "$REPORT"
psql -U aion -d aion -Atc "
  SELECT version || '  ' || name || '  ' || executed_at
  FROM schema_migrations ORDER BY executed_at DESC LIMIT 10;
" 2>/dev/null >> "$REPORT" || echo "(no schema_migrations)" >> "$REPORT"
echo '```' >> "$REPORT"

echo "### Archivos de migracion en disco (ultimos 20)" >> "$REPORT"
echo '```' >> "$REPORT"
ls -lat /opt/aion/db/migrations/ 2>/dev/null | head -21 >> "$REPORT" || true
echo '```' >> "$REPORT"

echo "### Tablas SIN Row Level Security" >> "$REPORT"
echo '```' >> "$REPORT"
psql -U aion -d aion -Atc "
  SELECT tablename FROM pg_tables
  WHERE schemaname='public' AND rowsecurity=false
  ORDER BY tablename;
" 2>/dev/null >> "$REPORT" || echo "(query fallo)" >> "$REPORT"
echo '```' >> "$REPORT"

# ============================================================================
# 5) Secretos expuestos (gitleaks en historia reciente)
# ============================================================================
echo "" >> "$REPORT"
echo "## 5. Escaneo de secretos (ultimas 2 semanas)" >> "$REPORT"
echo '```' >> "$REPORT"
cd /opt/aion
gitleaks detect --source . --log-opts="--since=2.weeks" --no-banner --report-format=json \
  --report-path="$AUDIT_DIR/gitleaks.json" 2>&1 | tail -20 >> "$REPORT" || true
echo '```' >> "$REPORT"

# ============================================================================
# 6) Procesos huerfanos (PM2 que no estan en ecosystem.config.js)
# ============================================================================
echo "" >> "$REPORT"
echo "## 6. Procesos PM2 potencialmente huerfanos" >> "$REPORT"
echo '```' >> "$REPORT"
ECOSYSTEM_APPS="$(node -e "
  const c = require('/opt/aion/ecosystem.config.js');
  c.apps.forEach(a => console.log(a.name));
" 2>/dev/null || echo '')"

pm2 jlist | jq -r '.[].name' | while read -r APP; do
  if ! echo "$ECOSYSTEM_APPS" | grep -qx "$APP"; then
    echo "HUERFANO: $APP"
  fi
done >> "$REPORT"
echo '```' >> "$REPORT"

# ============================================================================
# 7) Clasificacion automatica
# ============================================================================
echo "" >> "$REPORT"
echo "## 7. Clasificacion y recomendaciones" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Repo | Estado | Accion recomendada |" >> "$REPORT"
echo "|------|--------|--------------------|" >> "$REPORT"
for r in "${REPOS[@]}"; do
  DIR="/opt/aion/$r"
  [[ -d "$DIR/.git" ]] || continue
  cd "$DIR"

  if [[ -z "$(git status --short)" ]] && [[ -z "$(git log --oneline @{u}..HEAD 2>/dev/null)" ]]; then
    STATUS="CLEAN"
    ACTION="Ninguna"
  elif [[ -z "$(git status --short)" ]] && [[ -n "$(git log --oneline @{u}..HEAD 2>/dev/null)" ]]; then
    STATUS="COMMITS LOCALES"
    ACTION="git push origin main"
  elif [[ -n "$(git status --short)" ]] && [[ -z "$(git diff --name-only)" ]]; then
    STATUS="UNTRACKED"
    ACTION="Revisar manualmente"
  else
    STATUS="DIRTY"
    ACTION="Commit/stash/discard (ver diffs guardados)"
  fi
  echo "| \`$r\` | $STATUS | $ACTION |" >> "$REPORT"
done

echo "" >> "$REPORT"
echo "---" >> "$REPORT"
echo "Diffs completos guardados en: \`$AUDIT_DIR/*.diff\`" >> "$REPORT"
echo "Para commitear todo lo limpio automaticamente:" >> "$REPORT"
echo "" >> "$REPORT"
echo '```bash' >> "$REPORT"
echo "bash $AUDIT_DIR/../audit-autocommit.sh   # revisa primero, luego ejecuta" >> "$REPORT"
echo '```' >> "$REPORT"

echo ""
echo "Auditoria lista: $REPORT"
cat "$REPORT" | head -100
```

---

## DESPUES DE LA AUDITORIA

1. **Lee el reporte completo** (`cat $REPORT | less`).
2. Para cada fila DIRTY de la tabla S7, toma decision:
   - **commit** si el cambio tiene proposito y pasa lint/typecheck.
   - **stash** si es WIP no terminado (nombrarlo: `git stash push -m "wip: <razon>"`).
   - **discard** si es basura (`git checkout -- <archivo>`).
3. Ejecuta los commits agrupados por scope con Conventional Commits.
4. Push a cada repo.
5. Solo entonces pasa al deploy.

**No avances al deploy con cambios DIRTY sin reconciliar.**
