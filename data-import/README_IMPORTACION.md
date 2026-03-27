# Guía de Importación de Datos — Clave Seguridad

## Estructura de archivos

```
data-import/
├── templates/                    ← Plantillas CSV (editar con datos reales)
│   ├── 01_sites.csv             ← Sitios/Puestos (nombre, dirección, IP WAN)
│   ├── 02_sections.csv          ← Secciones por sitio (porterías, zonas, torres)
│   ├── 03_devices_ip.csv        ← Equipos por IP (DVR/NVR/cámaras con IP directa)
│   ├── 04_devices_p2p.csv       ← Equipos por P2P (serial, HikConnect/DMSS)
│   ├── 05_cloud_accounts.csv    ← Cuentas HikConnect y DMSS (referencia manual)
│   ├── 06_residents.csv         ← Residentes/empleados (nombre, doc, teléfono)
│   ├── 07_vehicles.csv          ← Vehículos (placa, marca, color)
│   ├── 08_emergency_contacts.csv← Contactos de emergencia
│   ├── 09_shifts.csv            ← Turnos de vigilancia
│   ├── 10_contracts.csv         ← Contratos con clientes
│   └── 11_email_accounts.csv    ← Cuentas de correo (referencia para .env)
├── .env.production.template     ← Plantilla de variables de entorno
├── import-all.ts                ← Script de importación masiva
└── README_IMPORTACION.md        ← Este archivo
```

## Paso 1: Editar las plantillas CSV

Abrir cada archivo CSV en Excel o Google Sheets y reemplazar los datos de ejemplo con los datos reales.

### Reglas importantes:
- **NO cambiar los encabezados** (primera fila)
- **Los nombres de sitios deben coincidir** entre archivos (ej: el sitio en `01_sites.csv` debe escribirse igual en `03_devices_ip.csv`)
- **Los documentos de identidad** son la clave para vincular residentes con vehículos
- Usar comillas dobles para valores con comas: `"Cra 45 #12-30, Bogotá"`

### Datos por archivo:

| Archivo | Qué llenar | Ejemplo |
|---------|-----------|---------|
| `01_sites.csv` | Cada puesto/sede con su IP pública | IP WAN del router |
| `02_sections.csv` | Zonas de cada puesto | Portería, torre, parqueadero |
| `03_devices_ip.csv` | Equipos con conexión por IP directa | DVR en 192.168.1.64, usuario admin |
| `04_devices_p2p.csv` | Equipos con conexión P2P | Serial del DVR, cuenta HikConnect |
| `05_cloud_accounts.csv` | Cuentas de HikConnect/DMSS | Solo referencia, se configuran en la UI |
| `06_residents.csv` | Residentes, empleados, propietarios | Nombre, cédula, teléfono, apartamento |
| `07_vehicles.csv` | Vehículos vinculados por cédula | Placa, marca, modelo, color |
| `08_emergency_contacts.csv` | CAI, bomberos, administrador | Nombre, teléfono, disponibilidad |
| `09_shifts.csv` | Turnos de guardas | Diurno 06:00-18:00, nocturno |
| `10_contracts.csv` | Contratos con clientes | Número, valor mensual, servicios |
| `11_email_accounts.csv` | Correos para notificaciones | Solo referencia para configurar .env |

## Paso 2: Configurar variables de entorno

```bash
# Copiar la plantilla
cp data-import/.env.production.template backend/.env

# Generar clave de cifrado
openssl rand -hex 16
# Copiar el resultado en CREDENTIAL_ENCRYPTION_KEY

# Generar JWT secret
openssl rand -base64 48
# Copiar el resultado en JWT_SECRET
```

Editar `backend/.env` y reemplazar todos los `<<REEMPLAZAR>>`.

## Paso 3: Ejecutar la importación

```bash
# Instalar dependencias si no están
cd backend && pnpm install && cd ..

# Modo prueba (no escribe en BD)
cd backend/apps/backend-api
npx tsx ../../../data-import/import-all.ts --dry-run

# Importación real
npx tsx ../../../data-import/import-all.ts

# Importar solo un paso específico
npx tsx ../../../data-import/import-all.ts --only sites
npx tsx ../../../data-import/import-all.ts --only devices-ip
npx tsx ../../../data-import/import-all.ts --only residents
```

### Pasos disponibles:
`sites` → `sections` → `devices-ip` → `devices-p2p` → `residents` → `vehicles` → `contacts` → `shifts` → `contracts`

## Paso 4: Configurar cuentas cloud (HikConnect/DMSS)

Estas cuentas se configuran desde la interfaz web o por API:

### HikConnect:
```bash
curl -X POST http://localhost:3000/cloud/ezviz/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{"username": "tu_usuario@email.com", "password": "tu_password"}'
```

### DMSS/IMOU:
```bash
curl -X POST http://localhost:3000/cloud/imou/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{"username": "tu_usuario@email.com", "password": "tu_password"}'
```

Después de autenticar, importar dispositivos desde la UI: **Dispositivos → Panel Cloud → Importar**.

## Paso 5: Verificar

```bash
# Verificar sitios
curl http://localhost:3000/sites -H "Authorization: Bearer <token>"

# Verificar dispositivos
curl http://localhost:3000/devices -H "Authorization: Bearer <token>"

# Verificar residentes
curl http://localhost:3000/access/people -H "Authorization: Bearer <token>"
```

## Seguridad

- Las credenciales de dispositivos se cifran con **AES-256-GCM** automáticamente
- Los archivos CSV con datos reales **NUNCA deben subirse a Git**
- El archivo `.env` con claves reales **NUNCA debe subirse a Git**
- Las plantillas CSV están en `.gitignore` por defecto

## Importar desde Excel existente

Si ya tienes datos en Excel:
1. Abrir el Excel
2. Copiar las columnas relevantes a la plantilla CSV correspondiente
3. Guardar como CSV (UTF-8)
4. Ejecutar el script

## Resolución de problemas

| Error | Solución |
|-------|----------|
| `DATABASE_URL not set` | Ejecutar desde `backend/apps/backend-api` con `.env` configurado |
| `No tenants found` | Crear un tenant primero (registro en la app o seed) |
| `Site not found for device` | El nombre del sitio en el CSV del dispositivo no coincide con `01_sites.csv` |
| `Person not found for vehicle` | El `residentDocumentId` no coincide con `documentId` en `06_residents.csv` |
