# CI Investigation — `validate-and-deploy.yml` failing pre-existing

**Fecha:** 2026-04-20 04:30 UTC
**Workflow ID:** 261169074
**Alcance:** `jlort1721-alt/aion-vision-hub` · `jlort1721-alt/aion-platform` · `jlort1721-alt/aionseg-platform`

---

## Síntomas observados

- `gh run list --workflow validate-and-deploy.yml --limit 20` → **20/20 failure**, sin runs success recientes.
- `gh run view <ID> --log-failed` → HTTP 404 (`log not found`), `/actions/runs/<ID>/jobs` → `{"total_count":0,"jobs":[]}`.
- `gh run rerun <ID>` → `"run cannot be rerun; its workflow file may be broken"`.
- `gh workflow run validate-and-deploy.yml --ref main` → `"Workflow does not have 'workflow_dispatch' trigger"` **aunque el YAML SÍ lo tiene**:
  ```yaml
  on:
    push:
      branches: [main]
    workflow_dispatch:
      inputs:
        skip_build: { ... }
        force_color: { options: ["", "blue", "green"] }
  ```
- El YAML parsea limpio localmente (sin tabs, sin inputs vacíos, estructura válida).

## Conclusión

**GitHub Actions no está leyendo correctamente este workflow.** La API reporta runs como "completed failure" pero con `jobs:[]` — nunca se ejecutó ningún job. El parser acepta el archivo (porque runs se registran) pero falla a nivel de **dispatcher**, probablemente por uno de:

1. **Cache corrupto del workflow** — GitHub mantiene versión antigua indexada por `workflowId=261169074` que no cuadra con la del archivo.
2. **Edge case de parser** — el valor `""` dentro de `options: ["", "blue", "green"]` puede estar invalidando el `workflow_dispatch` input sin emitir error visible.
3. **Sintaxis ambigua en deploy job** — los heredoc `ssh ... bash -lc "'...'"` con interpolación anidada `${{ … }}` pueden estar disparando un path roto en GH cuando intenta planear el job graph.

## Evidencia pre-existente

Los runs failing son **anteriores a Fase 2**:
- 2026-04-17 ya había failure (ver `docs/audit/2026-04-20-validation-p1-gaps.md` GAP-M2).
- Los commits de Fase 2 (`308a9eb`, `f45d047`, `31803e4`) NO modificaron este workflow.
- El commit que ingresó este YAML es más antiguo que esa ventana.

No es una regresión introducida por el trabajo de remediation/2026-04-aion-full-audit.

## Opciones (no ejecutadas — requiere decisión operativa)

### Opción A — Borrar y recrear el workflow

Cambia el `workflowId` y limpia cualquier cache corrupto de GitHub:

```bash
git rm .github/workflows/validate-and-deploy.yml
git commit -m "ci: reset broken validate-and-deploy workflow"
git push origin main
# … luego crear un nuevo file con otro nombre o el mismo contenido
git add .github/workflows/validate-and-deploy.yml
git commit -m "ci: re-add validate-and-deploy with clean workflowId"
git push origin main
```

Riesgo: si otros workflows tenían `needs: validate-and-deploy` o alguna automatización externa referenciaba el ID 261169074, se rompe.

### Opción B — Normalizar el YAML

Eliminar el `""` de las options, aplanar los heredoc anidados, separar `workflow_dispatch` a un archivo distinto:

```yaml
options: ["auto", "blue", "green"]  # en vez de ["", "blue", "green"]
default: "auto"
```

Y en el deploy job, extraer el script a un `.sh` que `scp`-ed previamente al runner y se invoca sin heredoc.

### Opción C — Aceptar y consolidar con `ci.yml`

El repo tiene otros workflows (`ci.yml`, `deploy-production.yml`, `deploy-staging.yml`, `deploy.yml`) que duplican muchas de las etapas de `validate-and-deploy.yml`. Si esos están verdes, borrar `validate-and-deploy.yml` no pierde cobertura.

Validar antes:
```bash
gh run list --repo jlort1721-alt/aion-vision-hub --workflow ci.yml --limit 5 --json conclusion
gh run list --repo jlort1721-alt/aion-vision-hub --workflow deploy-production.yml --limit 5 --json conclusion
```

Si todas las otras están en success, `validate-and-deploy.yml` es deuda técnica pura y se puede borrar.

## Recomendación

**Opción C**, condicionada a verificación de los otros workflows. Es la de menor riesgo y elimina el ruido CI que estaba generando los 20 failures visibles.

Si los otros workflows también están rotos, primero reparar uno (Opción B aplicada a `ci.yml`), luego borrar `validate-and-deploy.yml`.

## Scope de Fase B

Esta investigación es **solo diagnóstica**. No se aplicó Opción A/B/C porque:
- Requieren decisión operativa sobre consolidación de pipelines.
- Opción A puede romper automatizaciones externas sin aviso.
- Opción B requiere regression tests del deploy pipeline.

**GAP-M2 marcado como "investigado — no regresión de Fase 2; decisión operativa requerida para remediarlo."**
