# Rotacion de Credenciales — Post-Sesion

## Acciones requeridas por la propietaria

### 1. Rotar contrasena de la cuenta principal

- **Cuenta:** jlort1721@gmail.com en https://aionseg.co
- **Accion:** Cambiar la contrasena desde el panel de usuario
- **Razon:** La contrasena fue usada durante la sesion de auditoria via variable de entorno

### 2. Tokens/sesiones generados durante la auditoria

- **JWT de prueba:** generados con el JWT_SECRET del backend, expiran en 1 hora. No requiere accion (ya expiraron).
- **No se crearon usuarios efimeros** en esta sesion (no fue necesario para las pruebas realizadas).
- **No se modificaron API keys** externas (Anthropic, Twilio, eWeLink).

### 3. Verificaciones post-rotacion

Despues de cambiar la contrasena:
1. Cerrar sesion en todos los dispositivos
2. Verificar que se puede iniciar sesion con la nueva contrasena
3. Verificar que el dashboard carga correctamente
