# Guia de Configuracion — Dahua REGISTRO (Active Registration)

## Requisitos previos

- XVR/NVR/DVR Dahua con firmware que soporte "Registro en Plataforma" (Active Register)
- Acceso a la interfaz web del dispositivo via LAN (tipicamente http://192.168.1.108)
- Conexion a internet activa en la sede

## Paso a paso

### 1. Acceder al XVR

Conectarse a la misma red LAN del XVR y abrir en el navegador:

```
http://[IP_LOCAL_DEL_XVR]
```

Credenciales por defecto del proyecto: `admin` / `Clave.seg2023`

### 2. Navegar a la configuracion de Red

Ir a: **Configuracion** > **Red** > **Registro en Plataforma**

(En firmware en ingles: **Setup** > **Network** > **Register** o **Platform Access**)

### 3. Configurar REGISTRO

| Campo | Valor |
|---|---|
| Habilitar | **ON** (activar) |
| Servidor | `registro.aionseg.co` |
| Puerto | `5000` |
| ID del dispositivo | Dejar el serial por defecto (ej: `AL02505PAJD40E7`) |

### 4. Guardar y reiniciar

1. Hacer clic en **Guardar** / **OK**
2. Reiniciar el XVR: **Configuracion** > **Sistema** > **Mantenimiento** > **Reiniciar**
3. Esperar 2-3 minutos a que el dispositivo reconecte

### 5. Verificar conexion

Desde el servidor AION, verificar que el dispositivo aparece en go2rtc:

```bash
curl http://localhost:1984/api/streams | python3 -m json.tool | grep "da-"
```

O verificar via la API de AION:

```bash
curl http://localhost:3001/dahua/registro/devices
```

## Dispositivos Dahua del proyecto

| Sede | Serial | Canales | Nombre en AION |
|---|---|---|---|
| Alborada | AL02505PAJD40E7 | 8 | alborada |
| Brescia | AK01E46PAZ0BA9C | 8 | brescia |
| Patio Bonito | AL02505PAJDC6A4 | 8 | pbonito |
| Terrabamba | BB01B89PAJ5DDCD | 8 | terrabamba |
| Danubios Clave | AJ00421PAZF2E60 | 8 | danubios |
| Danubios Puesto | AH0306CPAZ5EA1A | 8 | danubios2 |
| Terrazzino | AL02505PAJ638AA | 8 | terrazzino |
| Terrazzino 2 | AH0306CPAZ5E9FA | 8 | terrazzino2 |
| Quintas Santa Maria | AH1020EPAZ39E67 | 8 | quintas |
| Santana Cabanas | AB081E4PAZD6D5B | 8 | santana |
| Hospital San Jeronimo | AE01C60PAZA4D94 | 8 | hospital |
| Factory | 9B02D09PAZ4C0D2 | 4 | factory |

## Troubleshooting

**El dispositivo no aparece en go2rtc:**
1. Verificar que el XVR tiene conexion a internet (`ping 8.8.8.8` desde la consola del XVR)
2. Verificar que el puerto 5000 esta abierto en el servidor: `sudo ufw status | grep 5000`
3. Verificar que go2rtc tiene el listener dvrip activo: `curl http://localhost:1984/api/config`
4. Revisar logs de go2rtc: `journalctl -u go2rtc -f`

**El video se ve pero se congela:**
1. Verificar ancho de banda de subida en la sede (minimo 2 Mbps por canal substream)
2. Cambiar de mainstream a substream en go2rtc (subtype=1)
3. Reducir resolucion del substream en el XVR: **Configuracion** > **Camara** > **Video** > **Extra Stream**

**Error de autenticacion:**
1. Verificar credenciales en la base de datos de AION
2. Algunos XVR requieren Digest Auth (el cliente ya lo soporta automaticamente)
