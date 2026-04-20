# OpenClaw — Secrets Rotation Runbook

**Ámbito:** rotación de credenciales del servicio `openclaw.service` en VPS `aion-vps` (18.230.40.6).

**Última migración:** 2026-04-20 — plaintext en unit → vault `/etc/aion/secrets/openclaw.env` vía drop-in override.

---

## 1. Arquitectura del vault

```
/etc/aion/secrets/                       # 700 root:root
└── openclaw.env                         # 600 root:root — contiene las 3 keys

/etc/systemd/system/openclaw.service               # base unit (NO tocar, viene del paquete)
/etc/systemd/system/openclaw.service.d/
└── override.conf                        # drop-in con Environment= (clear) + EnvironmentFile=
```

`override.conf` limpia cualquier `Environment=` inline de la unidad base y fuerza a leer desde el file. Las envs no-secretas (`HOME`, `OPENCLAW_HOME`, `NVM_DIR`) se re-declaran dentro del override.

---

## 2. Variables gestionadas

| Variable | Origen | Rotación | Uso |
|---|---|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Trimestral o ante incidente | Llamadas LLM secundarias |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | Trimestral o ante incidente | Modelo principal Claude |
| `OPENCLAW_GATEWAY_TOKEN` | `openssl rand -hex 32` | Semestral | Auth HTTP al gateway local |
| `CLAUDE_MODEL` | — | Al subir modelo | Default `claude-opus-4-7` |

---

## 3. Procedimiento de rotación

### 3.1 Rotar una key (ejemplo: Anthropic)

1. **Generar la nueva key** en la consola del proveedor y guardarla en gestor local del operador.
2. **Editar el vault sin quedar en el history del shell:**

   ```bash
   ssh aion-vps
   sudo install -m 600 -o root -g root /dev/null /etc/aion/secrets/openclaw.env.new
   sudo cp /etc/aion/secrets/openclaw.env /etc/aion/secrets/openclaw.env.new
   sudo -e /etc/aion/secrets/openclaw.env.new    # sudoedit usa $EDITOR; sustituir solo la línea ANTHROPIC_API_KEY=...
   sudo mv /etc/aion/secrets/openclaw.env.new /etc/aion/secrets/openclaw.env
   sudo chmod 600 /etc/aion/secrets/openclaw.env
   sudo chown root:root /etc/aion/secrets/openclaw.env
   ```

3. **Reiniciar:**

   ```bash
   sudo systemctl restart openclaw
   ```

4. **Verificar:**

   ```bash
   sudo systemctl status openclaw --no-pager | head -15
   sudo journalctl -u openclaw --since "1 min ago" --no-pager | tail -20
   curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18789/health
   ```

5. **Revocar la key vieja** en la consola del proveedor (nunca antes de confirmar que la nueva funciona).

### 3.2 Rotar el Gateway Token

```bash
ssh aion-vps
sudo bash -c 'NEW=$(openssl rand -hex 32); \
  sudo -e /etc/aion/secrets/openclaw.env; \
  # sustituir OPENCLAW_GATEWAY_TOKEN=<VIEJO> → =$NEW
  sudo systemctl restart openclaw'
```

El token también vive en `/home/openclaw/.openclaw/.env` y en cualquier cliente que invoque el gateway. Actualizarlos en paralelo.

---

## 4. Verificación post-rotación

| Check | Comando esperado |
|---|---|
| Servicio activo | `systemctl is-active openclaw` → `active` |
| Health HTTP | `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18789/health` → `200` |
| Último reporte OpenClaw | `sudo ls -t /home/openclaw/devops/reports/ \| head -1` (ts reciente) |
| Sin errores auth | `sudo journalctl -u openclaw --since "5 min ago" \| grep -iE "unauthoriz\|401\|auth fail"` → vacío |
| Drop-in cargado | `sudo systemctl show openclaw -p DropInPaths` → contiene `override.conf` |

---

## 5. Reglas de seguridad

- **Nunca** escribir una key en un comando que quede en `.bash_history`: usar `sudoedit` o `install -m 600`.
- **Nunca** commitear `/etc/aion/secrets/*` al repo (ya está fuera del repo, pero validar con `secret-scan` hook).
- **Nunca** pasar las keys por chat ni por email. Transport: SSH al VPS directamente, gestor de contraseñas, o canal cifrado E2E.
- Si una key se exhibió (screenshots, logs compartidos, snapshot EBS antiguo): **rotar inmediatamente** y auditar `journalctl --since "<fecha_exhibición>" | grep -i openai`.

---

## 6. Recuperación ante pérdida del vault

Si `/etc/aion/secrets/openclaw.env` se borra o corrompe:

```bash
ssh aion-vps
sudo systemctl stop openclaw
sudo install -m 600 -o root -g root /dev/null /etc/aion/secrets/openclaw.env
sudo -e /etc/aion/secrets/openclaw.env     # pegar estructura del §2 con keys actuales
sudo systemctl start openclaw
```

Si además se perdió el override:

```bash
sudo mkdir -p /etc/systemd/system/openclaw.service.d
sudo -e /etc/systemd/system/openclaw.service.d/override.conf
# pegar:
# [Service]
# Environment=
# EnvironmentFile=/etc/aion/secrets/openclaw.env
# Environment=HOME=/home/openclaw
# Environment=OPENCLAW_HOME=/home/openclaw/.openclaw
# Environment=NVM_DIR=/home/openclaw/.nvm
sudo systemctl daemon-reload
sudo systemctl restart openclaw
```

---

## 7. Cambios históricos

| Fecha | Acción | Operador |
|---|---|---|
| 2026-04-20 | Migración inicial de unit plaintext → vault + drop-in | Claude Code |
