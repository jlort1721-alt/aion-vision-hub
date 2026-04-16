# Por que no usamos P2P directo (dh-p2p) para Dahua

## Contexto

Existe un proyecto open-source (khoanguyen-3fc/dh-p2p) que implementa
el protocolo P2P de Dahua en Rust/Python. El MASTER_PLAN v1.2.0 lo
incluia como componente `dh-p2p-manager` para crear tuneles RTSP
directos a los XVR Dahua sin depender de IMOU Cloud.

## Por que se descarto

### 1. Dependencia de Easy4IPCloud (el mismo problema)

El protocolo P2P de Dahua, incluso implementado localmente, **requiere
Easy4IPCloud como servidor de rendezvous** para el handshake inicial.
Esto significa que:

- El XVR debe estar registrado en la nube Easy4IP/IMOU
- El servidor de rendezvous (`cmgw-online-vg.imoulife.com`) debe estar
  accesible
- Si el XVR no esta en la nube, P2P directo tampoco funciona

Esto es exactamente el problema que tenemos: los 4 XVR faltantes
(DNXVR002, TZXVR002, SAXVR001, FCXVR001) **no estan registrados en
la nube IMOU/Easy4IP**. El P2P directo no resuelve esta limitacion.

### 2. Proyecto sin soporte production-grade

- Ultimo commit: 2024 (1+ ano sin actualizacion)
- Issues abiertos sin resolver
- Sin CI/CD, sin tests automatizados
- Dependencias Rust + Python mezcladas

### 3. Riesgo de ruptura silenciosa

Dahua puede cambiar el protocolo P2P en cualquier firmware update
sin previo aviso. Un cambio en el handshake o en la encriptacion
romperia el cliente sin que lo sepamos hasta que los streams dejen
de funcionar.

### 4. La via oficial es mas simple y robusta

IMOU Life (la app oficial) + la API IMOU Open Platform son la forma
soportada por Dahua para acceso cloud. Funcionan con todos los
firmwares, tienen SLA de disponibilidad, y no requieren ingenieria
reversa.

## Que se usa en su lugar

| Metodo | Prioridad | Cuando |
|---|---|---|
| IMOU P2P HLS | 1 (default) | XVR registrado en IMOU Cloud |
| HTTP CGI directo | 2 (fallback) | XVR con port-forward HTTP:80 |
| Go reverse-gateway | 3 (futuro) | Con SDKs propietarios instalados |

## Como agregar un XVR Dahua nuevo en el futuro

1. Registrar en IMOU Life (10 minutos)
2. El IMOU stream manager de AION lo detecta automaticamente
3. En 15 minutos aparece como `healthy` en Vision Hub

Si no es posible IMOU:
1. Configurar port-forward HTTP:80 al XVR en el router del sitio
2. El native-device-bridge de AION lo detecta via CGI directo
3. En 30 segundos aparece como `healthy`
