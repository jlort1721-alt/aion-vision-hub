-- ═══════════════════════════════════════════════════════════════════════════
-- Complete Schema Sync: 29 Missing Tables
-- Syncs Supabase with ALL Drizzle ORM schema definitions (alerts, operations,
-- phase3, phase4 modules). Uses IF NOT EXISTS for idempotent execution.
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════╗
-- ║                   ALERTS MODULE                           ║
-- ╚═══════════════════════════════════════════════════════════╝


-- ── 1. alert_rules ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  conditions        JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions           JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity          VARCHAR(16) NOT NULL DEFAULT 'medium',
  cooldown_minutes  INTEGER NOT NULL DEFAULT 5,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID NOT NULL,
  last_triggered_at TIMESTAMPTZ,
  trigger_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_rules' AND policyname = 'Tenant sees alert rules') THEN
    CREATE POLICY "Tenant sees alert rules"
    ON public.alert_rules FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_rules' AND policyname = 'Operators create alert rules') THEN
    CREATE POLICY "Operators create alert rules"
    ON public.alert_rules FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_rules' AND policyname = 'Operators update alert rules') THEN
    CREATE POLICY "Operators update alert rules"
    ON public.alert_rules FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_rules' AND policyname = 'Admins delete alert rules') THEN
    CREATE POLICY "Admins delete alert rules"
    ON public.alert_rules FOR DELETE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant
  ON public.alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active
  ON public.alert_rules(tenant_id, is_active);


-- ── 2. escalation_policies ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalation_policies (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  levels      JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_policies' AND policyname = 'Tenant sees escalation policies') THEN
    CREATE POLICY "Tenant sees escalation policies"
    ON public.escalation_policies FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_policies' AND policyname = 'Admins manage escalation policies') THEN
    CREATE POLICY "Admins manage escalation policies"
    ON public.escalation_policies FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_escalation_policies_tenant
  ON public.escalation_policies(tenant_id);


-- ── 3. alert_instances ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_instances (
  id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id               UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  event_id              UUID,
  status                VARCHAR(32) NOT NULL DEFAULT 'firing',
  severity              VARCHAR(16) NOT NULL DEFAULT 'medium',
  title                 VARCHAR(255) NOT NULL,
  message               TEXT,
  current_level         INTEGER NOT NULL DEFAULT 1,
  escalation_policy_id  UUID REFERENCES public.escalation_policies(id),
  acknowledged_by       UUID,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID,
  resolved_at           TIMESTAMPTZ,
  actions_log           JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata              JSONB DEFAULT '{}'::jsonb,
  next_escalation_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_instances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_instances' AND policyname = 'Tenant sees alert instances') THEN
    CREATE POLICY "Tenant sees alert instances"
    ON public.alert_instances FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_instances' AND policyname = 'Operators create alert instances') THEN
    CREATE POLICY "Operators create alert instances"
    ON public.alert_instances FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_instances' AND policyname = 'Operators update alert instances') THEN
    CREATE POLICY "Operators update alert instances"
    ON public.alert_instances FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_instances' AND policyname = 'Admins delete alert instances') THEN
    CREATE POLICY "Admins delete alert instances"
    ON public.alert_instances FOR DELETE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alert_instances_tenant_status
  ON public.alert_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_rule
  ON public.alert_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_created
  ON public.alert_instances(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alert_instances_escalation
  ON public.alert_instances(next_escalation_at);


-- ── 4. notification_channels ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(32) NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_channels' AND policyname = 'Tenant sees notification channels') THEN
    CREATE POLICY "Tenant sees notification channels"
    ON public.notification_channels FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_channels' AND policyname = 'Admins manage notification channels') THEN
    CREATE POLICY "Admins manage notification channels"
    ON public.notification_channels FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant
  ON public.notification_channels(tenant_id);


-- ── 5. notification_log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id        UUID REFERENCES public.notification_channels(id),
  alert_instance_id UUID REFERENCES public.alert_instances(id),
  type              VARCHAR(32) NOT NULL,
  recipient         VARCHAR(512) NOT NULL,
  subject           VARCHAR(255),
  message           TEXT,
  status            VARCHAR(32) NOT NULL DEFAULT 'pending',
  error             TEXT,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'Tenant sees notification log') THEN
    CREATE POLICY "Tenant sees notification log"
    ON public.notification_log FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'System inserts notification log') THEN
    CREATE POLICY "System inserts notification log"
    ON public.notification_log FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant
  ON public.notification_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_alert
  ON public.notification_log(alert_instance_id);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║              OPERATIONS MODULE                            ║
-- ╚═══════════════════════════════════════════════════════════╝


-- ── 6. shifts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id       UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  days_of_week  JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  max_guards    INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shifts' AND policyname = 'Tenant sees shifts') THEN
    CREATE POLICY "Tenant sees shifts"
    ON public.shifts FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shifts' AND policyname = 'Admins manage shifts') THEN
    CREATE POLICY "Admins manage shifts"
    ON public.shifts FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_tenant
  ON public.shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_site
  ON public.shifts(site_id);


-- ── 7. shift_assignments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shift_id          UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  date              TIMESTAMPTZ NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  check_in_at       TIMESTAMPTZ,
  check_out_at      TIMESTAMPTZ,
  check_in_location JSONB,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_assignments' AND policyname = 'Tenant sees shift assignments') THEN
    CREATE POLICY "Tenant sees shift assignments"
    ON public.shift_assignments FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_assignments' AND policyname = 'Operators manage shift assignments') THEN
    CREATE POLICY "Operators manage shift assignments"
    ON public.shift_assignments FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

-- Guards can update their own assignments (check-in/check-out)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_assignments' AND policyname = 'Guards update own shift assignments') THEN
    CREATE POLICY "Guards update own shift assignments"
    ON public.shift_assignments FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND user_id = auth.uid()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant
  ON public.shift_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift
  ON public.shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date
  ON public.shift_assignments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status
  ON public.shift_assignments(tenant_id, status);


-- ── 8. sla_definitions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sla_definitions (
  id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  description              TEXT,
  severity                 VARCHAR(16) NOT NULL,
  response_time_minutes    INTEGER NOT NULL,
  resolution_time_minutes  INTEGER NOT NULL,
  business_hours_only      BOOLEAN NOT NULL DEFAULT false,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sla_definitions' AND policyname = 'Tenant sees SLA definitions') THEN
    CREATE POLICY "Tenant sees SLA definitions"
    ON public.sla_definitions FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sla_definitions' AND policyname = 'Admins manage SLA definitions') THEN
    CREATE POLICY "Admins manage SLA definitions"
    ON public.sla_definitions FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sla_definitions_tenant
  ON public.sla_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_severity
  ON public.sla_definitions(tenant_id, severity);


-- ── 9. sla_tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sla_tracking (
  id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sla_id                UUID NOT NULL REFERENCES public.sla_definitions(id) ON DELETE CASCADE,
  incident_id           UUID,
  event_id              UUID,
  response_deadline     TIMESTAMPTZ NOT NULL,
  resolution_deadline   TIMESTAMPTZ NOT NULL,
  responded_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  response_breached     BOOLEAN NOT NULL DEFAULT false,
  resolution_breached   BOOLEAN NOT NULL DEFAULT false,
  breach_notified_at    TIMESTAMPTZ,
  status                VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sla_tracking' AND policyname = 'Tenant sees SLA tracking') THEN
    CREATE POLICY "Tenant sees SLA tracking"
    ON public.sla_tracking FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sla_tracking' AND policyname = 'Operators manage SLA tracking') THEN
    CREATE POLICY "Operators manage SLA tracking"
    ON public.sla_tracking FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sla_tracking_tenant
  ON public.sla_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_status
  ON public.sla_tracking(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_deadlines
  ON public.sla_tracking(response_deadline);


-- ── 10. emergency_protocols ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_protocols (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(64) NOT NULL,
  description   TEXT,
  steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_actions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority      INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_protocols ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_protocols' AND policyname = 'Tenant sees emergency protocols') THEN
    CREATE POLICY "Tenant sees emergency protocols"
    ON public.emergency_protocols FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_protocols' AND policyname = 'Admins manage emergency protocols') THEN
    CREATE POLICY "Admins manage emergency protocols"
    ON public.emergency_protocols FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emergency_protocols_tenant
  ON public.emergency_protocols(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_type
  ON public.emergency_protocols(tenant_id, type);


-- ── 11. emergency_contacts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(128) NOT NULL,
  phone           VARCHAR(32) NOT NULL,
  email           VARCHAR(255),
  priority        INTEGER NOT NULL DEFAULT 1,
  available_hours JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_contacts' AND policyname = 'Tenant sees emergency contacts') THEN
    CREATE POLICY "Tenant sees emergency contacts"
    ON public.emergency_contacts FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_contacts' AND policyname = 'Admins manage emergency contacts') THEN
    CREATE POLICY "Admins manage emergency contacts"
    ON public.emergency_contacts FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_tenant
  ON public.emergency_contacts(tenant_id);


-- ── 12. emergency_activations ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_activations (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  protocol_id   UUID NOT NULL REFERENCES public.emergency_protocols(id),
  site_id       UUID REFERENCES public.sites(id),
  activated_by  UUID NOT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'active',
  timeline      JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved_by   UUID,
  resolved_at   TIMESTAMPTZ,
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_activations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_activations' AND policyname = 'Tenant sees emergency activations') THEN
    CREATE POLICY "Tenant sees emergency activations"
    ON public.emergency_activations FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emergency_activations' AND policyname = 'Operators manage emergency activations') THEN
    CREATE POLICY "Operators manage emergency activations"
    ON public.emergency_activations FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emergency_activations_tenant
  ON public.emergency_activations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_activations_status
  ON public.emergency_activations(tenant_id, status);


-- ── 13. patrol_routes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patrol_routes (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  estimated_minutes   INTEGER NOT NULL DEFAULT 30,
  frequency_minutes   INTEGER NOT NULL DEFAULT 60,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrol_routes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_routes' AND policyname = 'Tenant sees patrol routes') THEN
    CREATE POLICY "Tenant sees patrol routes"
    ON public.patrol_routes FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_routes' AND policyname = 'Admins manage patrol routes') THEN
    CREATE POLICY "Admins manage patrol routes"
    ON public.patrol_routes FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patrol_routes_tenant
  ON public.patrol_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patrol_routes_site
  ON public.patrol_routes(site_id);


-- ── 14. patrol_checkpoints ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patrol_checkpoints (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  route_id        UUID NOT NULL REFERENCES public.patrol_routes(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  location        JSONB,
  "order"         INTEGER NOT NULL DEFAULT 0,
  qr_code         VARCHAR(255),
  required_photo  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrol_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_checkpoints' AND policyname = 'Tenant sees patrol checkpoints') THEN
    CREATE POLICY "Tenant sees patrol checkpoints"
    ON public.patrol_checkpoints FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_checkpoints' AND policyname = 'Admins manage patrol checkpoints') THEN
    CREATE POLICY "Admins manage patrol checkpoints"
    ON public.patrol_checkpoints FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patrol_checkpoints_route
  ON public.patrol_checkpoints(route_id);


-- ── 15. patrol_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patrol_logs (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  route_id        UUID NOT NULL REFERENCES public.patrol_routes(id),
  checkpoint_id   UUID REFERENCES public.patrol_checkpoints(id),
  user_id         UUID NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'completed',
  scanned_at      TIMESTAMPTZ,
  notes           TEXT,
  photo_url       VARCHAR(1024),
  incident_id     UUID,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Tenant sees patrol logs') THEN
    CREATE POLICY "Tenant sees patrol logs"
    ON public.patrol_logs FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Operators create patrol logs') THEN
    CREATE POLICY "Operators create patrol logs"
    ON public.patrol_logs FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

-- Guards can insert their own patrol logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_logs' AND policyname = 'Guards create own patrol logs') THEN
    CREATE POLICY "Guards create own patrol logs"
    ON public.patrol_logs FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND user_id = auth.uid()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patrol_logs_tenant
  ON public.patrol_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_route
  ON public.patrol_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_user
  ON public.patrol_logs(user_id, created_at);


-- ── 16. scheduled_reports ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(64) NOT NULL,
  schedule      JSONB NOT NULL,
  recipients    JSONB NOT NULL DEFAULT '{}'::jsonb,
  format        VARCHAR(16) NOT NULL DEFAULT 'pdf',
  filters       JSONB DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  last_error    TEXT,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_reports' AND policyname = 'Tenant sees scheduled reports') THEN
    CREATE POLICY "Tenant sees scheduled reports"
    ON public.scheduled_reports FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scheduled_reports' AND policyname = 'Admins manage scheduled reports') THEN
    CREATE POLICY "Admins manage scheduled reports"
    ON public.scheduled_reports FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant
  ON public.scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run
  ON public.scheduled_reports(next_run_at);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║               PHASE 3 MODULE                              ║
-- ╚═══════════════════════════════════════════════════════════╝


-- ── 17. automation_rules ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  trigger           JSONB NOT NULL,
  conditions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions           JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority          INTEGER NOT NULL DEFAULT 1,
  cooldown_minutes  INTEGER NOT NULL DEFAULT 5,
  last_triggered_at TIMESTAMPTZ,
  trigger_count     INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_rules' AND policyname = 'Tenant sees automation rules') THEN
    CREATE POLICY "Tenant sees automation rules"
    ON public.automation_rules FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_rules' AND policyname = 'Admins manage automation rules') THEN
    CREATE POLICY "Admins manage automation rules"
    ON public.automation_rules FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant
  ON public.automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active
  ON public.automation_rules(tenant_id, is_active);


-- ── 18. automation_executions ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id           UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  trigger_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  results           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            VARCHAR(32) NOT NULL DEFAULT 'success',
  execution_time_ms INTEGER,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_executions' AND policyname = 'Tenant sees automation executions') THEN
    CREATE POLICY "Tenant sees automation executions"
    ON public.automation_executions FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_executions' AND policyname = 'System inserts automation executions') THEN
    CREATE POLICY "System inserts automation executions"
    ON public.automation_executions FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_executions_tenant
  ON public.automation_executions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_rule
  ON public.automation_executions(rule_id);


-- ── 19. visitors ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitors (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  document_id     VARCHAR(64),
  phone           VARCHAR(32),
  email           VARCHAR(255),
  company         VARCHAR(255),
  photo_url       VARCHAR(1024),
  visit_reason    VARCHAR(64) NOT NULL DEFAULT 'personal',
  host_name       VARCHAR(255),
  host_unit       VARCHAR(64),
  host_phone      VARCHAR(32),
  notes           TEXT,
  is_blacklisted  BOOLEAN NOT NULL DEFAULT false,
  visit_count     INTEGER NOT NULL DEFAULT 0,
  last_visit_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitors' AND policyname = 'Tenant sees visitors') THEN
    CREATE POLICY "Tenant sees visitors"
    ON public.visitors FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitors' AND policyname = 'Operators manage visitors') THEN
    CREATE POLICY "Operators manage visitors"
    ON public.visitors FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visitors_tenant
  ON public.visitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitors_document
  ON public.visitors(tenant_id, document_id);
CREATE INDEX IF NOT EXISTS idx_visitors_site
  ON public.visitors(site_id);


-- ── 20. visitor_passes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitor_passes (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id      UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  qr_token        VARCHAR(128) NOT NULL,
  pass_type       VARCHAR(32) NOT NULL DEFAULT 'single_use',
  valid_from      TIMESTAMPTZ NOT NULL,
  valid_until     TIMESTAMPTZ NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  check_in_at     TIMESTAMPTZ,
  check_out_at    TIMESTAMPTZ,
  check_in_by     UUID,
  authorized_by   UUID NOT NULL,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor_passes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_passes' AND policyname = 'Tenant sees visitor passes') THEN
    CREATE POLICY "Tenant sees visitor passes"
    ON public.visitor_passes FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_passes' AND policyname = 'Operators manage visitor passes') THEN
    CREATE POLICY "Operators manage visitor passes"
    ON public.visitor_passes FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visitor_passes_tenant
  ON public.visitor_passes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_visitor
  ON public.visitor_passes(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_qr
  ON public.visitor_passes(qr_token);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_status
  ON public.visitor_passes(tenant_id, status);


-- ── 21. kpi_snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period        VARCHAR(16) NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kpi_snapshots' AND policyname = 'Tenant sees KPI snapshots') THEN
    CREATE POLICY "Tenant sees KPI snapshots"
    ON public.kpi_snapshots FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kpi_snapshots' AND policyname = 'System inserts KPI snapshots') THEN
    CREATE POLICY "System inserts KPI snapshots"
    ON public.kpi_snapshots FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_tenant_period
  ON public.kpi_snapshots(tenant_id, period, period_start);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║               PHASE 4 MODULE                              ║
-- ╚═══════════════════════════════════════════════════════════╝


-- ── 22. contracts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id           UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  contract_number   VARCHAR(64) NOT NULL,
  client_name       VARCHAR(255) NOT NULL,
  client_document   VARCHAR(64),
  client_email      VARCHAR(255),
  client_phone      VARCHAR(32),
  type              VARCHAR(32) NOT NULL DEFAULT 'monthly',
  status            VARCHAR(32) NOT NULL DEFAULT 'draft',
  start_date        DATE NOT NULL,
  end_date          DATE,
  monthly_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'COP',
  services          JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_terms     VARCHAR(32) NOT NULL DEFAULT 'net_30',
  auto_renew        BOOLEAN NOT NULL DEFAULT false,
  notes             TEXT,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Tenant sees contracts') THEN
    CREATE POLICY "Tenant sees contracts"
    ON public.contracts FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Admins manage contracts') THEN
    CREATE POLICY "Admins manage contracts"
    ON public.contracts FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contracts_tenant
  ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status
  ON public.contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_site
  ON public.contracts(site_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number
  ON public.contracts(tenant_id, contract_number);


-- ── 23. invoices ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id       UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  invoice_number    VARCHAR(64) NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'draft',
  issue_date        DATE NOT NULL,
  due_date          DATE NOT NULL,
  subtotal          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate          NUMERIC(5, 2) NOT NULL DEFAULT 19,
  tax_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'COP',
  line_items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_at           TIMESTAMPTZ,
  paid_amount       NUMERIC(12, 2),
  payment_method    VARCHAR(32),
  payment_reference VARCHAR(128),
  notes             TEXT,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Tenant sees invoices') THEN
    CREATE POLICY "Tenant sees invoices"
    ON public.invoices FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Admins manage invoices') THEN
    CREATE POLICY "Admins manage invoices"
    ON public.invoices FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
  ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract
  ON public.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_number
  ON public.invoices(tenant_id, invoice_number);


-- ── 24. key_inventory ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.key_inventory (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id           UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  key_code          VARCHAR(64) NOT NULL,
  label             VARCHAR(255) NOT NULL,
  description       TEXT,
  key_type          VARCHAR(32) NOT NULL DEFAULT 'access',
  status            VARCHAR(32) NOT NULL DEFAULT 'available',
  current_holder    VARCHAR(255),
  current_holder_id UUID,
  location          VARCHAR(255),
  copies            INTEGER NOT NULL DEFAULT 1,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.key_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'key_inventory' AND policyname = 'Tenant sees key inventory') THEN
    CREATE POLICY "Tenant sees key inventory"
    ON public.key_inventory FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'key_inventory' AND policyname = 'Operators manage key inventory') THEN
    CREATE POLICY "Operators manage key inventory"
    ON public.key_inventory FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_key_inventory_tenant
  ON public.key_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_key_inventory_site
  ON public.key_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_key_inventory_code
  ON public.key_inventory(tenant_id, key_code);
CREATE INDEX IF NOT EXISTS idx_key_inventory_status
  ON public.key_inventory(tenant_id, status);


-- ── 25. key_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.key_logs (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_id        UUID NOT NULL REFERENCES public.key_inventory(id) ON DELETE CASCADE,
  action        VARCHAR(32) NOT NULL,
  from_holder   VARCHAR(255),
  to_holder     VARCHAR(255),
  performed_by  UUID NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.key_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'key_logs' AND policyname = 'Tenant sees key logs') THEN
    CREATE POLICY "Tenant sees key logs"
    ON public.key_logs FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'key_logs' AND policyname = 'Operators create key logs') THEN
    CREATE POLICY "Operators create key logs"
    ON public.key_logs FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_key_logs_tenant
  ON public.key_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_key_logs_key
  ON public.key_logs(key_id);


-- ── 26. compliance_templates ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_templates (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(64) NOT NULL,
  content     TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_templates' AND policyname = 'Tenant sees compliance templates') THEN
    CREATE POLICY "Tenant sees compliance templates"
    ON public.compliance_templates FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_templates' AND policyname = 'Admins manage compliance templates') THEN
    CREATE POLICY "Admins manage compliance templates"
    ON public.compliance_templates FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compliance_templates_tenant
  ON public.compliance_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_templates_type
  ON public.compliance_templates(tenant_id, type);


-- ── 27. data_retention_policies ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  data_type         VARCHAR(64) NOT NULL,
  retention_days    INTEGER NOT NULL,
  action            VARCHAR(32) NOT NULL DEFAULT 'delete',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_executed_at  TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_retention_policies' AND policyname = 'Tenant sees data retention policies') THEN
    CREATE POLICY "Tenant sees data retention policies"
    ON public.data_retention_policies FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_retention_policies' AND policyname = 'Admins manage data retention policies') THEN
    CREATE POLICY "Admins manage data retention policies"
    ON public.data_retention_policies FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_retention_tenant
  ON public.data_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_type
  ON public.data_retention_policies(tenant_id, data_type);


-- ── 28. training_programs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_programs (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(64) NOT NULL,
  duration_hours  INTEGER NOT NULL,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  validity_months INTEGER NOT NULL DEFAULT 12,
  passing_score   INTEGER NOT NULL DEFAULT 70,
  content         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_programs' AND policyname = 'Tenant sees training programs') THEN
    CREATE POLICY "Tenant sees training programs"
    ON public.training_programs FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_programs' AND policyname = 'Admins manage training programs') THEN
    CREATE POLICY "Admins manage training programs"
    ON public.training_programs FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_programs_tenant
  ON public.training_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_category
  ON public.training_programs(tenant_id, category);


-- ── 29. certifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certifications (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  user_name       VARCHAR(255) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'enrolled',
  score           INTEGER,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  certificate_url VARCHAR(1024),
  notes           TEXT,
  issued_by       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certifications' AND policyname = 'Tenant sees certifications') THEN
    CREATE POLICY "Tenant sees certifications"
    ON public.certifications FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certifications' AND policyname = 'Admins manage certifications') THEN
    CREATE POLICY "Admins manage certifications"
    ON public.certifications FOR ALL TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    )
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

-- Users can see their own certifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certifications' AND policyname = 'Users see own certifications') THEN
    CREATE POLICY "Users see own certifications"
    ON public.certifications FOR SELECT TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND user_id = auth.uid()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certifications_tenant
  ON public.certifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_certifications_program
  ON public.certifications(program_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user
  ON public.certifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status
  ON public.certifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_certifications_expiry
  ON public.certifications(tenant_id, expires_at);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║          UPDATED_AT TRIGGERS                              ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Helper: create trigger only if it does not already exist
DO $$ BEGIN
  -- alert_rules
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_rules_updated_at') THEN
    CREATE TRIGGER update_alert_rules_updated_at
      BEFORE UPDATE ON public.alert_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- escalation_policies
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_escalation_policies_updated_at') THEN
    CREATE TRIGGER update_escalation_policies_updated_at
      BEFORE UPDATE ON public.escalation_policies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- alert_instances
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_instances_updated_at') THEN
    CREATE TRIGGER update_alert_instances_updated_at
      BEFORE UPDATE ON public.alert_instances
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- notification_channels
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_channels_updated_at') THEN
    CREATE TRIGGER update_notification_channels_updated_at
      BEFORE UPDATE ON public.notification_channels
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- shifts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shifts_updated_at') THEN
    CREATE TRIGGER update_shifts_updated_at
      BEFORE UPDATE ON public.shifts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- shift_assignments
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shift_assignments_updated_at') THEN
    CREATE TRIGGER update_shift_assignments_updated_at
      BEFORE UPDATE ON public.shift_assignments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- sla_definitions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sla_definitions_updated_at') THEN
    CREATE TRIGGER update_sla_definitions_updated_at
      BEFORE UPDATE ON public.sla_definitions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- sla_tracking
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sla_tracking_updated_at') THEN
    CREATE TRIGGER update_sla_tracking_updated_at
      BEFORE UPDATE ON public.sla_tracking
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- emergency_protocols
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_emergency_protocols_updated_at') THEN
    CREATE TRIGGER update_emergency_protocols_updated_at
      BEFORE UPDATE ON public.emergency_protocols
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- emergency_activations
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_emergency_activations_updated_at') THEN
    CREATE TRIGGER update_emergency_activations_updated_at
      BEFORE UPDATE ON public.emergency_activations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- patrol_routes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patrol_routes_updated_at') THEN
    CREATE TRIGGER update_patrol_routes_updated_at
      BEFORE UPDATE ON public.patrol_routes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- scheduled_reports
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduled_reports_updated_at') THEN
    CREATE TRIGGER update_scheduled_reports_updated_at
      BEFORE UPDATE ON public.scheduled_reports
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- automation_rules
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_rules_updated_at') THEN
    CREATE TRIGGER update_automation_rules_updated_at
      BEFORE UPDATE ON public.automation_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- visitors
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_visitors_updated_at') THEN
    CREATE TRIGGER update_visitors_updated_at
      BEFORE UPDATE ON public.visitors
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- contracts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contracts_updated_at') THEN
    CREATE TRIGGER update_contracts_updated_at
      BEFORE UPDATE ON public.contracts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- invoices
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at') THEN
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- key_inventory
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_key_inventory_updated_at') THEN
    CREATE TRIGGER update_key_inventory_updated_at
      BEFORE UPDATE ON public.key_inventory
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- compliance_templates
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_templates_updated_at') THEN
    CREATE TRIGGER update_compliance_templates_updated_at
      BEFORE UPDATE ON public.compliance_templates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- data_retention_policies
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_data_retention_policies_updated_at') THEN
    CREATE TRIGGER update_data_retention_policies_updated_at
      BEFORE UPDATE ON public.data_retention_policies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- training_programs
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_training_programs_updated_at') THEN
    CREATE TRIGGER update_training_programs_updated_at
      BEFORE UPDATE ON public.training_programs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- certifications
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_certifications_updated_at') THEN
    CREATE TRIGGER update_certifications_updated_at
      BEFORE UPDATE ON public.certifications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║          AUTO-VACUUM TUNING (HIGH-VOLUME TABLES)          ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE IF EXISTS public.alert_instances SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.notification_log SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.patrol_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.automation_executions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.sla_tracking SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.key_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.shift_assignments SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS public.kpi_snapshots SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║          REALTIME PUBLICATION                             ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Add new tables to realtime (safe: duplicates are silently ignored by Supabase)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_instances;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_activations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.patrol_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_assignments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sla_tracking;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_passes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_executions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════
-- Migration complete: 29 tables created with RLS, policies,
-- indexes, updated_at triggers, vacuum tuning, and realtime.
-- ═══════════════════════════════════════════════════════════
