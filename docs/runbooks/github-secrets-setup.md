# GitHub Secrets — Setup Runbook

**Objetivo:** configurar los tres repos espejo (`aion-vision-hub`, `aion-platform`, `aionseg-platform`) para que sus GitHub Actions puedan hacer SSH al VPS y validar/deployar sin credenciales en el repo.

**Workflow asociado:** `.github/workflows/secret-validation.yml`.

---

## 1. Secrets obligatorios

| Nombre | Contenido | Scope |
|---|---|---|
| `VPS_SSH_KEY` | Llave privada PEM completa (multilinea) que autentica al usuario del VPS | Repository |
| `VPS_HOST` | `18.230.40.6` | Repository |
| `VPS_USER` | `ubuntu` | Repository |
| `VPS_KNOWN_HOSTS` | Output de `ssh-keyscan -H 18.230.40.6` (multilinea) | Repository |
| `DOCKERHUB_TOKEN` _(opcional)_ | Personal Access Token si el workflow empuja imágenes | Repository |

Secrets opcionales:

| Nombre | Uso |
|---|---|
| `SLACK_WEBHOOK_URL` | Notificación de deploy failed / success |
| `ANTHROPIC_API_KEY` | Para jobs que llamen Claude (p. ej. openclaw-exporter dry-run) |

---

## 2. Generar y subir `VPS_SSH_KEY` (un solo repo de ejemplo)

### 2.1 Local (una sola vez por operador)

```bash
# La llave existente para este proyecto
ls -la ~/.ssh/clave-demo-aion.pem

# Confirmar que conecta
ssh -i ~/.ssh/clave-demo-aion.pem ubuntu@18.230.40.6 'echo ok'
# → ok
```

### 2.2 Copiar el PEM (todo el contenido, incluidas las líneas `BEGIN`/`END`)

En macOS:

```bash
pbcopy < ~/.ssh/clave-demo-aion.pem
```

### 2.3 GitHub Web UI

1. Abrir `https://github.com/jlort1721-alt/aion-vision-hub/settings/secrets/actions`.
2. Click **New repository secret**.
3. Name: `VPS_SSH_KEY`.
4. Value: **pegar** con Ctrl+V (el portapapeles ya tiene el PEM).
5. Click **Add secret**.
6. Repetir para `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS` (ver §2.4).

### 2.4 `VPS_KNOWN_HOSTS`

```bash
ssh-keyscan -H 18.230.40.6 2>/dev/null | pbcopy
```

Pegar como secret `VPS_KNOWN_HOSTS` en el repo.

---

## 3. Replicar en los 3 repos

Repos que requieren los mismos secrets:

- `jlort1721-alt/aion-vision-hub`
- `jlort1721-alt/aion-platform`
- `jlort1721-alt/aionseg-platform`

Si hay muchos secrets, la CLI `gh` ahorra clics:

```bash
# Instalar gh si no está: https://cli.github.com/
gh auth login

for repo in aion-vision-hub aion-platform aionseg-platform; do
  gh secret set VPS_SSH_KEY     --repo jlort1721-alt/$repo < ~/.ssh/clave-demo-aion.pem
  gh secret set VPS_HOST        --repo jlort1721-alt/$repo --body "18.230.40.6"
  gh secret set VPS_USER        --repo jlort1721-alt/$repo --body "ubuntu"
  ssh-keyscan -H 18.230.40.6 2>/dev/null | gh secret set VPS_KNOWN_HOSTS --repo jlort1721-alt/$repo
done
```

`gh secret set` nunca echoea el valor — seguro para terminales compartidas.

---

## 4. Verificación

1. En cada repo → **Actions** → **secret-validation** → **Run workflow** (manual dispatch).
2. El job "Required GitHub Secrets present" debe pasar.
3. Si falla: el log dice exactamente qué secret falta.

Para probar SSH real, ejecutar un workflow que use `webfactory/ssh-agent`:

```yaml
- uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.VPS_SSH_KEY }}
- run: |
    echo "${{ secrets.VPS_KNOWN_HOSTS }}" >> ~/.ssh/known_hosts
    ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} 'pm2 list --no-colors | head -10'
```

---

## 5. Rotación

### 5.1 Cambiar la llave SSH

```bash
# 1. Generar nueva llave local
ssh-keygen -t ed25519 -f ~/.ssh/aion-vps-2026Q2 -C "aion-vps-2026Q2"

# 2. Agregar pública al VPS (el usuario operador, con la vieja todavía activa)
ssh-copy-id -i ~/.ssh/aion-vps-2026Q2.pub ubuntu@18.230.40.6

# 3. Subir PEM a GitHub como VPS_SSH_KEY (reemplaza la vieja)
for repo in aion-vision-hub aion-platform aionseg-platform; do
  gh secret set VPS_SSH_KEY --repo jlort1721-alt/$repo < ~/.ssh/aion-vps-2026Q2
done

# 4. Revocar la vieja en el VPS
ssh ubuntu@18.230.40.6 'sed -i "/aion-vps-2025/d" ~/.ssh/authorized_keys'
```

### 5.2 `VPS_HOST` / `VPS_USER` cambios

Raros. Si cambia IP del VPS (ej. migración AWS), actualizar `VPS_HOST` + regenerar `VPS_KNOWN_HOSTS`.

---

## 6. Seguridad

- **No** commitear el PEM ni siquiera en un archivo que no esté tracked — puede terminar en git-stash / backup.
- **No** copiar el contenido por chat / email; usar GitHub UI (TLS) o `gh secret set` (cifrado en tránsito).
- El workflow `secret-validation` corre gitleaks en cada PR — intenta detectar filtraciones accidentales.
- Secrets en Actions son mostrados como `***` en los logs; si aparece texto literal, hay riesgo y hay que rotar.
