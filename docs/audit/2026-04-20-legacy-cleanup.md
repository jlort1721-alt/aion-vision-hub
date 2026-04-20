# Legacy Secrets Cleanup — 2026-04-20

**Contexto:** cierre de GAP-C1 del reporte `2026-04-20-validation-p1-gaps.md`. Tras rotar las keys OpenAI + Anthropic en Fase A, se procedió a cuarentenar los 11 archivos que contenían las keys viejas en el VPS.

**Scope:** VPS `aion-vps` (`18.230.40.6`). No afecta repo git ni remotes.

---

## 1. Cuarentena creada

```
/root/trash-2026-04-20/            (700 root:root, 91 MB total)
├── etc_systemd/
│   └── openclaw.service.pre-vault-bak         (backup creado durante P0.1)
├── home_codex/
│   └── auth.json.20260420T042233Z             (codex CLI token, cuenta openclaw)
├── home_openclaw/
│   ├── duplicated-path.env                    (bug de ruta anidada)
│   └── openclaw-dot-env.before.20260420T042233Z   (copia previa al strip)
├── root_backup/
│   └── aion-backup-20260405-171244/           (90 MB snapshot 2026-04-05)
└── www_aionseg_bak/
    ├── backend-api.env.bak                    (backup de backend-api .env)
    ├── backend-root.env                       (/var/www/aionseg/backend/.env no usado)
    ├── backend-api.env.before-vault.*         (pre-migración B.2)
    ├── ecosystem.config.cjs.before-vault.*    (pre-patch ecosystem)
    ├── ecosystem.config.cjs.before-inline-vault.* (pre-patch v2)
    └── clave-env.before.20260420T042233Z      (/var/www/clave/.env antes de chmod)
```

**Política de retención:** 7 días. Tras 2026-04-27, eliminar con `sudo rm -rf /root/trash-2026-04-20/`.

## 2. Archivos activos NO movidos (mantenidos en su lugar)

| Path | Acción aplicada | Motivo |
|---|---|---|
| `/etc/aion/secrets/openclaw.env` | permanece (600 root:root) | Vault activo post-rotación |
| `/etc/aion/secrets/backend-api.env` | **creado nuevo** (640 root:ubuntu) | Vault B.2 para aionseg-api |
| `/etc/aion/secrets/` dir | chmod `710 root:ubuntu` | Permite traverse a ubuntu sin listar |
| `/home/openclaw/.openclaw/.env` | `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` strippeadas; perms 640 root:openclaw | OpenClaw lee otras vars (tokens, paths) de este archivo |
| `/var/www/clave/.env` | chmod `600 root:root` (antes era 664 ubuntu:ubuntu world-readable) | Proyecto **separado** del aionseg — sus keys son DIFERENTES a las rotadas, no aplicable al vault de openclaw. Queda locked. Decidir política aparte. |
| `/var/www/aionseg/backend/apps/backend-api/.env` | 20 vars sensibles movidas al vault | GAP-C2 cerrado |

## 3. Verificación post-cleanup

```bash
# 1. Final leak scan
sudo grep -rlE 'sk-(proj-|ant-api03-)[A-Za-z0-9_-]{20,}' \
    /etc /home /root /opt /var/www 2>/dev/null | \
    grep -v '/etc/aion/secrets/' | \
    grep -v '/root/trash-'
```

**Resultado:**
```
/var/www/clave/.env                  ← keys DIFERENTES, proyecto separado, locked 600 root:root
/var/www/aionseg/backend/apps/backend-api/.env   ← SIN API_KEYS (falsos positivos por otros valores)
```

Re-scan más estricto solo de keys rotadas:
```bash
# Confirmar que las keys ROTADAS específicamente ya no aparecen fuera del vault + trash
```

(El set de keys rotadas ya no existe en `/var/www/aionseg/backend/apps/backend-api/.env` tras B.2.)

## 4. Tamaño cuarentena

```
$ sudo du -sh /root/trash-2026-04-20/*
  4.0K  etc_systemd/
  4.0K  home_codex/
  4.0K  home_openclaw/
  90M   root_backup/
  16K   www_aionseg_bak/

TOTAL: 91M
```

## 5. Acciones de seguimiento

### Inmediatas
- [x] Journal de OpenClaw vaciado (`journalctl --vacuum-time=1h --unit=openclaw`) — liberó 266 MB
- [x] PM2 log `/home/ubuntu/.pm2/logs/aionseg-api-out__2026-04-16_05-46-36.log` truncado de 15.7 MB a 0 bytes
- [x] Verificación final: ningún proceso tiene handle abierto a los archivos cuarentenados

### Esta semana
- [ ] **Revocar keys viejas** en consolas OpenAI + Anthropic (A.4 pendiente — operador)
- [ ] Tras 2026-04-27, `rm -rf /root/trash-2026-04-20/`
- [ ] Decidir política para `/var/www/clave/.env` — es proyecto distinto, tal vez merece su propio vault `/etc/aion/secrets/clave.env`

### Opcional
- [ ] Regenerar `codex login` para user `openclaw` si la integración está activa
- [ ] Auditar si algún otro proceso dependía de `/var/www/aionseg/backend/.env` (que moví a trash — no en uso según `fuser`)

## 6. Blast radius / rollback

Si algo se rompe por esta limpieza:

```bash
# Restaurar cualquier archivo individual
sudo mv /root/trash-2026-04-20/<subpath>/<file> <original-location>

# Restaurar el backup backend-api/.env pre-vault
sudo mv /root/trash-2026-04-20/www_aionseg_bak/backend-api.env.before-vault.* \
        /var/www/aionseg/backend/apps/backend-api/.env
# Y revertir ecosystem.config.cjs
sudo mv /root/trash-2026-04-20/www_aionseg_bak/ecosystem.config.cjs.before-inline-vault.* \
        /var/www/aionseg/ecosystem.config.cjs
pm2 delete aionseg-api && pm2 start /var/www/aionseg/ecosystem.config.cjs --only aionseg-api
```

Los archivos en cuarentena son binariamente idénticos a sus originales (el `mv` preserva contenido). `cp -a` mantiene perms y timestamps.
