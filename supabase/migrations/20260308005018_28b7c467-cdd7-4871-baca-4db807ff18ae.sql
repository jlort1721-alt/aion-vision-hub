
CREATE TABLE public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role, module)
);

ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role permissions"
ON public.role_module_permissions
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Users read role permissions"
ON public.role_module_permissions
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));
