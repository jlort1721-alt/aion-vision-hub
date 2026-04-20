# Multi-remote `main` sync — Runbook

**Problema:** el proyecto vive en 3 remotes (`origin=aion-vision-hub`, `aion=aion-platform`, `aionseg=aionseg-platform`). Cuando se mergea un PR en `origin/main`, los otros dos remotes se quedan desincronizados.

**Solución:** workflow `.github/workflows/sync-main-remotes.yml` corre en cada push a `origin/main` y hace `git push aion main:main` + `git push aionseg main:main`.

**Estado inicial (2026-04-20):**
- origin main: **mergea activo, pulls PRs de dependabot** → siempre el más adelantado
- aion main: estaba en `819b8de` al momento del descubrimiento, 2 commits atrás
- aionseg main: idem

---

## 1. Secrets requeridos

El workflow usa `webfactory/ssh-agent@v0.9.0` con 2 llaves SSH deploy separadas (una por destino), más una identidad de commit.

| Secret | Dónde configurar | Contenido |
|---|---|---|
| `AION_SSH_KEY` | Settings → Secrets → Actions (en `aion-vision-hub`) | Clave SSH privada (formato OpenSSH o PEM) con acceso **push** a `jlort1721-alt/aion-platform` |
| `AIONSEG_SSH_KEY` | Idem | Clave SSH privada con acceso **push** a `jlort1721-alt/aionseg-platform` |
| `SYNC_GIT_USER` | _(opcional)_ | Nombre visible de los commits de sync; default `aion-sync-bot` |

## 2. Generar las 2 llaves SSH (una por destino)

Ejecutar **localmente** en una máquina de confianza:

```bash
# Llave para empujar a aion-platform
ssh-keygen -t ed25519 -f ~/.ssh/aion-platform-deploy \
  -C "aion-platform-deploy-key-2026-04-20" \
  -N ""

# Llave para empujar a aionseg-platform
ssh-keygen -t ed25519 -f ~/.ssh/aionseg-platform-deploy \
  -C "aionseg-platform-deploy-key-2026-04-20" \
  -N ""
```

Esto crea 4 archivos: `.../aion-platform-deploy`, `.../aion-platform-deploy.pub`, `.../aionseg-platform-deploy`, `.../aionseg-platform-deploy.pub`.

## 3. Registrar cada pública como "Deploy Key" del destino

**Para `aion-platform`:**

1. https://github.com/jlort1721-alt/aion-platform/settings/keys
2. **Add deploy key**
3. Title: `aion-sync-from-origin-2026-04-20`
4. Key: pegar contenido de `~/.ssh/aion-platform-deploy.pub`
5. **Allow write access** ✓
6. Save

**Para `aionseg-platform`:** mismo procedimiento en `aionseg-platform/settings/keys` con la otra llave pública.

## 4. Registrar las privadas como secrets en `aion-vision-hub`

Ir a https://github.com/jlort1721-alt/aion-vision-hub/settings/secrets/actions

| Secret | Cómo poblar |
|---|---|
| `AION_SSH_KEY` | `pbcopy < ~/.ssh/aion-platform-deploy` → New secret → pegar |
| `AIONSEG_SSH_KEY` | `pbcopy < ~/.ssh/aionseg-platform-deploy` → New secret → pegar |
| `SYNC_GIT_USER` | (opcional) `aion-sync-bot` |

Alternativa con CLI:

```bash
gh auth login
gh secret set AION_SSH_KEY     --repo jlort1721-alt/aion-vision-hub < ~/.ssh/aion-platform-deploy
gh secret set AIONSEG_SSH_KEY  --repo jlort1721-alt/aion-vision-hub < ~/.ssh/aionseg-platform-deploy
gh secret set SYNC_GIT_USER    --repo jlort1721-alt/aion-vision-hub --body "aion-sync-bot"
```

`gh secret set` nunca echoa el valor.

## 5. Dry-run para validar

Antes del primer uso, corre el workflow manualmente en modo dry-run:

```bash
gh workflow run sync-main-remotes.yml --repo jlort1721-alt/aion-vision-hub -f dry_run=true
```

Ir a Actions → ver el log. Debe mostrar:
- `origin main: <sha>`
- `aion main: <otro sha>`
- `aionseg main: <otro sha>`

Y **no** ejecuta los pushes.

## 6. Activación normal

Tras validar el dry-run, el workflow se auto-ejecuta en cada push a `origin/main` (merges de PR). Cero intervención manual.

## 7. Disparar sync manual tras merges históricos

Para el caso actual (antes del primer sync automático, los remotes están desincronizados):

```bash
gh workflow run sync-main-remotes.yml --repo jlort1721-alt/aion-vision-hub
# Ver el run
gh run list --repo jlort1721-alt/aion-vision-hub --workflow sync-main-remotes.yml --limit 1
```

Verificar post-sync:

```bash
for r in origin aion aionseg; do
  printf "%-8s " "$r:"; git ls-remote https://github.com/jlort1721-alt/${r/origin/aion-vision-hub}.git main | cut -f1 -- 2>/dev/null
done
```

(No es trivial por el mapping. Alternativa directa con tus remotes locales ya configurados: `git ls-remote <remote> main`.)

## 8. Failure scenarios

### "remote rejected: permission denied"
- La deploy key no tiene **Allow write access** marcado
- La deploy key está registrada en el repo equivocado
- Fix: §3, re-añadir con write=true

### "non-fast-forward"
- El remote destino tiene commits que `origin` no tiene (ej. alguien mergeó directo a `aion/main` antes del sync)
- Fix: NO forzar. Pedir al operador que investigue con `git log aion/main ^origin/main` antes de decidir si rebasar o merge.

### "workflow not running on push"
- El push puede haber sido a una rama distinta de `main`. El workflow solo dispara en `push: branches: [main]`.

## 9. Seguridad

- Las deploy keys tienen scope per-repo (no pueden acceder a otros repos de la org).
- El webfactory/ssh-agent action carga las llaves en la sesión de ese step y las elimina al final.
- Las llaves privadas NUNCA viajan al runner como archivo — vienen por env var secreto.
- Para rotación (recomendado 6 meses): repetir §2-§4, luego eliminar las deploy keys viejas en cada repo.

## 10. Alcance

Este workflow sincroniza **solo `main`**. Ramas de feature (remediation, dependabot, etc.) siguen el flujo normal (operador elige a qué remote empuja).

Si en el futuro quieres sincronizar también tags o releases, ampliar el workflow con `git push aion --tags` etc.
