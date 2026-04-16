# Manual de Operador — Vision Hub AION

## Como ver el estado

Abrir https://aionseg.co/vision-hub (requiere login)

### Colores de estado

| Color | Significado | Accion |
|---|---|---|
| Verde (healthy) | Dispositivo conectado y transmitiendo | Ninguna |
| Amarillo (degraded) | Dispositivo con fallas intermitentes | Monitorear 30 min, si no se recupera escalar |
| Rojo (failed) | Dispositivo sin conexion | Escalar a soporte tecnico |
| Gris (unknown) | Estado no determinado | Verificar en siguiente ciclo (30s) |

### Que hacer si un dispositivo pasa a rojo

1. Verificar si el sitio tiene internet (llamar al administrador del edificio)
2. Si el internet esta OK, puede ser el DVR/NVR apagado o colgado
3. Escalar a soporte tecnico con: nombre del sitio, device ID, hora del cambio

### Escalamiento

| Tipo de falla | Escalar a | Contacto |
|---|---|---|
| Internet del sitio caido | ISP del cliente | Segun contrato del edificio |
| DVR/NVR apagado | Tecnico de campo | Coordinador Clave Seguridad |
| Plataforma AION caida | Soporte VPS | Equipo desarrollo AION |

## Comandos basicos (sin SSH root)

Ver estado desde la web:
- Dashboard: https://aionseg.co/vision-hub
- API health: https://aionseg.co/api/health

Si tienes acceso SSH al VPS:
```bash
# Ver servicios
pm2 list

# Ver streams de video
curl -s http://127.0.0.1:1984/api/streams | jq 'keys | length'

# Ver rutas healthy
sudo -u postgres psql -d aionseg_prod -c "SELECT state, count(*) FROM reverse.routes GROUP BY state"
```
