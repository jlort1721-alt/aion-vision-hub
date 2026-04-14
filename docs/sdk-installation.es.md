# Instalacion de SDKs Propietarios — Hikvision y Dahua

## Resumen

El Go reverse-gateway necesita dos SDKs propietarios (bibliotecas .so nativas) para
comunicarse con los DVR/NVR via los protocolos ISUP 5.0 (Hikvision) y Platform Access (Dahua).
Sin estos SDKs, el gateway compila y arranca en modo stub pero no puede establecer sesiones
con los dispositivos.

## Paso 1: Descargar los SDKs

### Hikvision HCNetSDK

1. Ir a https://open.hikvision.com/en/
2. Registrarse como Developer (requiere email corporativo)
3. Navegar a: Resources > SDK Downloads > Device Network SDK
4. Descargar: **HCNetSDK V6.1.x Linux 64-bit** (archivo tipico: `CH-HCNetSDKV6.1.9.48_build20230410_linux64.tar.gz`)
5. El archivo pesa ~80-120 MB

### Dahua General NetSDK

1. Ir a https://www.dahuasecurity.com/support/developerCenter
2. Registrarse como Developer
3. Navegar a: SDK Downloads > General NetSDK
4. Descargar: **General NetSDK Linux x64** (archivo tipico: `General_NetSDK_Eng_Linux64_IS_V3.058.0000006.0.R.230712.tar.gz`)
5. El archivo pesa ~50-80 MB

## Paso 2: Subir al VPS

```bash
# Desde tu Mac local:
scp -i ~/Downloads/clave-demo-aion.pem \
  CH-HCNetSDKV6*.tar.gz \
  ubuntu@18.230.40.6:/tmp/hik-sdk.tar.gz

scp -i ~/Downloads/clave-demo-aion.pem \
  General_NetSDK*.tar.gz \
  ubuntu@18.230.40.6:/tmp/dahua-sdk.tar.gz
```

## Paso 3: Instalar

```bash
# Conectar al VPS:
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6

# Instalar Hikvision:
sudo bash /opt/aion/services/reverse-gateway/scripts/install/install-hik-sdk.sh /tmp/hik-sdk.tar.gz

# Instalar Dahua:
sudo bash /opt/aion/services/reverse-gateway/scripts/install/install-dahua-sdk.sh /tmp/dahua-sdk.tar.gz

# Verificar:
bash /opt/aion/services/reverse-gateway/scripts/install/verify-sdks.sh
```

## Paso 4: Recompilar el Gateway

```bash
cd /opt/aion/services/reverse-gateway

# Recompilar con soporte de SDKs (CGO habilitado)
export PATH=/usr/local/go/bin:$PATH
CGO_ENABLED=1 go build \
  -tags 'sdk_hikvision,sdk_dahua' \
  -o bin/gateway \
  ./cmd/gateway/

# Verificar que el binario enlaza correctamente
ldd bin/gateway | grep -E "hcnet|dhnet"
```

## Paso 5: Activar el Gateway

```bash
# Detener el platform-server Python (stub actual)
pm2 stop platform-server

# Iniciar el Go gateway
pm2 start /opt/aion/services/reverse-gateway/bin/gateway \
  --name aion-reverse-gateway \
  --interpreter none \
  -- --config /etc/aion/reverse/gateway.toml

pm2 save

# Verificar
pm2 logs aion-reverse-gateway --lines 20 --nostream
ss -tlnp | grep -E '7660|7681'
```

## Troubleshooting

### "GLIBC_2.xx not found"
El SDK requiere una version de glibc compatible con el sistema. Ubuntu 24.04
tiene glibc 2.39 — cualquier SDK compilado para Ubuntu 18+ deberia funcionar.

```bash
# Verificar version de glibc:
ldd --version
```

### "libhcnetsdk.so: cannot open shared object file"
El LD_LIBRARY_PATH no esta configurado. Verificar:
```bash
echo $LD_LIBRARY_PATH
cat /etc/ld.so.conf.d/hikvision-sdk.conf
sudo ldconfig -p | grep hcnet
```

### "SDK disabled in this build"
El binario fue compilado sin los build tags de SDK. Recompilar con:
```bash
CGO_ENABLED=1 go build -tags 'sdk_hikvision,sdk_dahua' -o bin/gateway ./cmd/gateway/
```

### El gateway arranca pero los dispositivos no conectan
1. Verificar firewall: `sudo ufw status | grep -E '7660|7681|7661'`
2. Verificar que los DVR/NVR estan configurados para apuntar a `18.230.40.6:7660` (Hik) o `:7681` (Dahua)
3. Verificar logs: `pm2 logs aion-reverse-gateway --lines 100`
4. Los dispositivos nuevos quedan en `pending_approval` — aprobar via API:
   ```bash
   curl -X POST http://127.0.0.1:3001/api/reverse/devices/<id>/approve \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"Clave.seg2023"}'
   ```
