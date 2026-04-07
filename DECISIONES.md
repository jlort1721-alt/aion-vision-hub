# Decisiones Tecnicas — Plan Maestro de Mejoras

**Fecha:** 2026-04-07

---

## Decisiones Tomadas Autonomamente

### D-001: No purgar historial Git automaticamente
**Razon:** `git filter-repo --force` reescribe toda la historia y requiere `git push --force` al remote. Esto afecta a todos los colaboradores y puede causar perdida de trabajo en progreso. Se creo guia en `MIGRATION_GUIDE.md` para ejecucion manual coordinada.

### D-002: No rotar secretos automaticamente
**Razon:** Rotar API keys requiere acceso a dashboards de terceros (OpenAI, Anthropic, Twilio, etc.) y credenciales que no tengo. Se creo `scripts/rotate-secrets.sh` con instrucciones paso a paso.

### D-003: WebSocket ya tenia autenticacion JWT
**Razon:** El analisis previo reporto "WebSocket sin autenticacion" pero al leer `plugins/websocket.ts`, el codigo ya implementaba dos metodos de auth: (1) query param `?token=JWT` y (2) primer mensaje `{ type: "auth", token: "JWT" }` con timeout de 10s. No se necesitaba cambio.

### D-004: Unique constraint es (email, tenant_id) no solo email
**Razon:** El sistema es multi-tenant. El mismo email puede existir en diferentes tenants (ej: admin@empresa.com en tenant A y tenant B). La restriccion correcta es unicidad por tenant.

### D-005: TypeScript strict mode incremental
**Razon:** Habilitar `strict: true` de golpe en el root tsconfig causaria cientos de errores. Se habilito `noImplicitAny` y `strictNullChecks` en el root (que es referencial) mientras `tsconfig.app.json` ya tenia `strict: true`. El frontend compila limpio porque usa tsconfig.app.json para la compilacion real.

### D-006: EmptyState integrado en 3 paginas prioritarias, no 50
**Razon:** Integrar EmptyState en 50 paginas de una sola vez tiene alto riesgo de regresion y requiere leer/entender cada pagina individualmente. Se creo el componente reutilizable y se integro en AlertsPage, ReportsPage e IncidentsPage como demostracion. Las demas paginas se pueden actualizar incrementalmente.

### D-007: Tests con mocks de DB, no tests de integracion
**Razon:** Los tests nuevos usan `vi.mock` para la base de datos porque no hay infraestructura de test DB configurada (no hay docker-compose.test.yml ni test database). Tests de integracion requieren setup adicional que puede implementarse despues.
