# AION Ecosystem Extension — para las 17 apps adicionales

Este micro-bundle te permite traer las 17 apps PM2 que NO están en el
`ecosystem.config.js` original al ciclo de blue-green / monitoreo / drainage,
SIN romper nada de lo que ya funciona.

## Archivos

| Archivo | Propósito |
|---|---|
| `inventory-pm2.sh` | Lee `pm2 jlist` del VPS y clasifica cada app automáticamente |
| `apps-classified.example.json` | Template para clasificación manual (4 categorías) |
| `generate-ecosystem-extra.sh` | Genera `ecosystem.extra.config.js` desde el JSON |
| `generate-extra-probes.sh` | Genera scrape configs Prometheus + alertas para las extras |
| `drain-app.sh` | Drena gracefully una app stateful antes de stop |

## Workflow (5 pasos, ~30 minutos)

### 1. Inventariar lo que está corriendo
```bash
# En el VPS
sudo -u aion ./inventory-pm2.sh > /tmp/pm2-inventory.md
sudo -u aion ./inventory-pm2.sh --json > /tmp/pm2-inventory.json
cat /tmp/pm2-inventory.md
```

Te dará una tabla así:

```
| App                    | Status | Mem | Restarts | Recommendation        |
|------------------------|--------|-----|----------|----------------------|
| aion-api-blue          | online | 234 |        2 | ALREADY_BG           |
| aion-n8n               | online | 512 |       18 | STATEFUL_NEEDS_BG    |
| aion-asterisk-bridge   | online | 145 |        4 | STATEFUL_NEEDS_BG    |
| aion-camera-snapshot   | online | 320 |        7 | STATEFUL_NEEDS_BG    |
| aion-mqtt-bridge       | online |  98 |        1 | BRIDGE_SINGLETON     |
| aion-events-worker     | online | 180 |        3 | STATELESS_SINGLETON  |
| aion-report-scheduler  | online |  64 |        0 | STATELESS_SINGLETON  |
| ...                    | ...    | ... |      ... | ...                  |
```

### 2. Clasificar manualmente (sobreescribiendo el template)
```bash
cp apps-classified.example.json apps-classified.json
nano apps-classified.json
```

Mueve cada app a SU categoría:
- **`stateful_blue_green`** → tiene estado en RAM (n8n con workflows en curso, snapshots en escritura, agente con SSE activo)
- **`bridge_singleton`** → bridge a sistema externo único (MQTT, webhook único)
- **`stateless_singleton`** → workers/cron (re-encolan jobs en SIGTERM)
- **`leave_alone`** → solo monitorear, no tocar

Para cada app define `cwd`, `script`, `port` (o `base_port` si es BG), y `env`.

### 3. Generar el ecosystem extra
```bash
./generate-ecosystem-extra.sh apps-classified.json > ecosystem.extra.config.js

# Validar sintaxis
node --check ecosystem.extra.config.js
```

Inspeccionar el resultado antes de aplicar:
```bash
node -e "console.log(JSON.stringify(require('./ecosystem.extra.config.js'), null, 2))" | less
```

### 4. Aplicar (en horario de bajo tráfico la primera vez)
```bash
# Copiar al VPS
scp ecosystem.extra.config.js aion@vps:/opt/aion/

# En el VPS — primero arrancar SOLO los blue
sudo -u aion pm2 start /opt/aion/ecosystem.extra.config.js --env production \
  --only "$(jq -r '.stateful_blue_green.apps[].name + "-blue"' apps-classified.json | paste -sd,)"

# Verificar health
for app in $(jq -r '.stateful_blue_green.apps[].name' apps-classified.json); do
  port=$(jq -r --arg n "$app" '.stateful_blue_green.apps[]|select(.name==$n)|.base_port' apps-classified.json)
  echo "$app:"
  curl -s "http://127.0.0.1:$port/health" | jq
done

# Si todo OK, arrancar bridges + workers
sudo -u aion pm2 start /opt/aion/ecosystem.extra.config.js --env production
sudo -u aion pm2 save
```

### 5. Generar y aplicar probes Prometheus
```bash
./generate-extra-probes.sh apps-classified.json > /tmp/prometheus-extra.yml

# Mergear en prometheus.yml (revisar manualmente primero)
cat /tmp/prometheus-extra.yml

# Aplicar
sudo -u aion bash -c '
  cat /tmp/prometheus-extra.yml >> /opt/aion/observability/prometheus/prometheus.yml
  cd /opt/aion/observability && docker compose restart prometheus
'

# Verificar que los nuevos targets aparecen
curl -s http://127.0.0.1:9090/api/v1/targets | jq '.data.activeTargets[].labels.job' | sort -u
```

## Drainage manual (cuando necesites parar una app stateful sin perder datos)

```bash
# Drena n8n-blue durante hasta 90s antes de pararla
sudo -u aion /opt/aion/scripts/drain-app.sh aion-n8n-blue 90
```

Esto requiere que tu app implemente:
- `POST /health?action=drain` → marca el flag interno `draining=true`
- `GET /health` → devuelve **200** si sano, **503** si está drenado y sin in-flight

Si tu app no tiene esos endpoints, `drain-app.sh` espera el `kill_timeout` del ecosystem (30s para stateful) y luego fuerza stop. Es menos limpio pero seguro.

## Integración con deploy.sh

Después de que el ecosystem extra esté operando, puedes extender el `deploy.sh` original para que el blue-green swap también drene las apps stateful extras. Patrón:

```bash
# En deploy.sh, antes de stop del color viejo:
for app in $(pm2 jlist | jq -r ".[] | select(.name | endswith(\"-${OLD_COLOR}\")) | .name"); do
  /opt/aion/scripts/drain-app.sh "$app" 60
done
```

Esto NO está en el bundle base — es una extensión opcional cuando ya tengas el ecosystem extra estable.

## Recomendación operativa

**No clasifiques las 17 apps de una sola vez.** Empieza con 2-3:

1. La que más restarts tiene (probablemente la más frágil y más se beneficia)
2. La más crítica para clientes (Vision Hub bridge, Asterisk, etc.)
3. La más simple (un worker stateless) — para ganar confianza en el flujo

Después de 1 semana con esas 3 corriendo bien, agrega las siguientes 4. Después de 2 semanas, las restantes. Esto te da tiempo de descubrir bugs por app sin colapsar la operación.

## Validación esperada

Cuando ejecutes el flow completo, deberías ver:

```bash
# pm2 list muestra pares blue/green para stateful + singleton para el resto
sudo -u aion pm2 list

# Prometheus reconoce los nuevos targets
curl -s http://127.0.0.1:9090/api/v1/targets \
  | jq '[.data.activeTargets[] | select(.labels.tier!=null)] | length'

# Grafana automáticamente los muestra (los queries por job_name ya existen)

# Alertmanager recibe alertas si paras una app a propósito
sudo -u aion pm2 stop aion-n8n-blue
# Esperar 2 minutos → alerta "ExtraAppDown" llega a Slack
sudo -u aion pm2 start aion-n8n-blue
```
