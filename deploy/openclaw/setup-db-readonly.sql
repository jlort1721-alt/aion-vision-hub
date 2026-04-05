-- ═══════════════════════════════════════════════════════════
-- Usuario PostgreSQL read-only para OpenClaw (aion-db-reader)
-- Ejecutar como superusuario: sudo -u postgres psql -f setup-db-readonly.sql
-- ═══════════════════════════════════════════════════════════

-- Crear rol read-only con limite de conexiones
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'openclaw_reader') THEN
        CREATE ROLE openclaw_reader WITH
            LOGIN
            PASSWORD 'REEMPLAZA_CON_PASSWORD_SEGURO'
            CONNECTION LIMIT 3
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT
            NOREPLICATION;
        RAISE NOTICE 'Rol openclaw_reader creado';
    ELSE
        RAISE NOTICE 'Rol openclaw_reader ya existe';
    END IF;
END
$$;

-- Permisos en aionseg_prod
\c aionseg_prod

-- Conectar a la base de datos
GRANT CONNECT ON DATABASE aionseg_prod TO openclaw_reader;

-- Acceso al schema public
GRANT USAGE ON SCHEMA public TO openclaw_reader;

-- SELECT en todas las tablas existentes
GRANT SELECT ON ALL TABLES IN SCHEMA public TO openclaw_reader;

-- SELECT en tablas futuras (para que no se rompa tras migraciones)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO openclaw_reader;

-- Revocar acceso a tablas sensibles (si existen)
DO $$
DECLARE
    sensitive_tables TEXT[] := ARRAY[
        'user_credentials',
        'api_keys',
        'encryption_keys',
        'oauth_tokens',
        'password_resets',
        'sessions',
        'refresh_tokens'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY sensitive_tables
    LOOP
        BEGIN
            EXECUTE format('REVOKE SELECT ON TABLE %I FROM openclaw_reader', t);
            RAISE NOTICE 'Revocado SELECT en %', t;
        EXCEPTION WHEN undefined_table THEN
            -- Tabla no existe, ignorar
            NULL;
        END;
    END LOOP;
END
$$;

-- Statement timeout por defecto para este usuario (10s)
ALTER ROLE openclaw_reader SET statement_timeout = '10s';

-- Row limit por defecto
ALTER ROLE openclaw_reader SET work_mem = '16MB';

-- Verificar
SELECT rolname, rolconnlimit, rolcanlogin
FROM pg_roles
WHERE rolname = 'openclaw_reader';
