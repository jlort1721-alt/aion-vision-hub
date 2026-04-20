# Imou Open Platform — Setup Runbook

**Objetivo:** Habilitar renovación programática de URLs HLS para los 13 dispositivos Dahua consumer del cliente vía Imou Open Platform.

**Skill asociado:** [`imou-refresh`](../../.claude/skills/imou-refresh/SKILL.md).

---

## 1. Quién ejecuta qué

| Paso | Responsable | Notas |
|---|---|---|
| Registrar cuenta dev en Imou | Cliente o AION ops | Formulario + verificación email |
| Crear aplicación "AION VMS" | Cliente/ops | Obtiene `appId` + `appSecret` |
| Asociar los 13 seriales a la app | Cliente | Desde la cuenta Imou donde están registrados los devices |
| Escribir secrets al vault | AION ops | Requiere SSH al VPS |
| Primera prueba con `--dry-run` | AION ops | Validar signature OK |

---

## 2. Registro (cliente/operador)

1. Abrir https://open.imoulife.com/ y crear cuenta dev.
2. Validar email. El perfil pide país, rubro (Security / Video Surveillance) y descripción del uso.
3. Una vez aprobada, **crear nueva aplicación**:
   - Tipo: **Server**
   - Nombre: `AION VMS Cliente <nombre>`
   - Callback URL: dejar vacío si no se usa OAuth end-user.
4. Copiar los valores **App ID** y **App Secret** (solo se muestran una vez — guardar en gestor de contraseñas).
5. En la misma consola, ir a **Device Management** → **Associate devices**:
   - Método recomendado: operador inicia sesión con la **cuenta Imou del cliente** desde la web de Imou; los 13 seriales aparecerán y se seleccionan todos → *Associate*.
   - Alternativa: delegar acceso mediante Token-Sharing (menos robusto).

---

## 3. Carga de secrets en VPS

```bash
ssh aion-vps

sudo install -m 600 -o root -g root /dev/null /etc/aion/secrets/imou.env
sudo -e /etc/aion/secrets/imou.env
# pegar:
# IMOU_APP_ID=<APP_ID>
# IMOU_APP_SECRET=<APP_SECRET>
# IMOU_API_BASE=https://openapi.easy4ip.com/openapi
```

Nota: el endpoint puede variar entre región LATAM (`openapi.easy4ip.com`) y otras (`openapi.imoulife.com`). Si la primera llamada devuelve HTTP 403 con `SignatureInvalid`, probar el alterno.

---

## 4. Primera ejecución (dry-run)

```bash
ssh aion-vps
sudo -i
cd /var/www/aionseg
bash .claude/skills/imou-refresh/scripts/refresh.sh --dry-run
cat /tmp/imou-refresh-*.md | head -40
```

Salida esperada: columnas `status` deberían leer `OK` para todos los seriales activos (NO habrá `NO-STREAM` salvo dispositivos offline).

Si ves `ACCESS-TOKEN-FAIL`: revisa appId/secret y hora del sistema (`timedatectl`).

---

## 5. Ejecución real + reload

```bash
bash .claude/skills/imou-refresh/scripts/refresh.sh --reload-go2rtc
```

Esto:
1. Renueva HLS para los 13 (persistidos en `devices.hls_url`).
2. Genera `/etc/aion/go2rtc-imou.fragment.yaml`.
3. Hace `POST /api/config` a go2rtc → reload en caliente.

Validar después:

```bash
bash .claude/skills/stream-health/scripts/probe.sh --probe-hls --filter='imou_.*' --output=/tmp/imou-post-refresh.md
cat /tmp/imou-post-refresh.md | head -30
```

Las filas `imou_*` deberían tener `hls_http=200`.

---

## 6. Programación (sugerida)

Imou firma URLs con expiración típica ≤ 24 h. Crear cron en `openclaw`:

```bash
sudo -u openclaw crontab -e
# Agregar:
0 */4 * * * /bin/bash /var/www/aionseg/.claude/skills/imou-refresh/scripts/refresh.sh --reload-go2rtc >> /home/openclaw/.openclaw/imou-refresh.log 2>&1
```

Cada 4 h + reload go2rtc mantiene los 13 siempre frescos.

---

## 7. Rotación del `APP_SECRET`

1. Regenerar secret en consola Imou (se invalida el anterior).
2. `sudo -e /etc/aion/secrets/imou.env` → sustituir `IMOU_APP_SECRET=`.
3. `sudo systemctl restart go2rtc` no es necesario (el skill lee el file cada corrida).
4. Ejecutar `refresh.sh --dry-run` para validar.

---

## 8. Cosas que NO hacer

- No commitear `imou.env` ni el `app secret` al repo.
- No dejar `IMOU_APP_SECRET` en `.bash_history` (usar `sudoedit`).
- No disparar `refresh.sh` más de una vez cada 5 min en testing (el endpoint rate-limitea).
- No reutilizar la misma app en dev/staging/prod: una por entorno.
