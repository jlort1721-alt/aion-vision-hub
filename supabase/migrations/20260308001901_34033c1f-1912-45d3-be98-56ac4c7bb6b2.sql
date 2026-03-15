-- Allow tenant admins to update their own tenant
CREATE POLICY "Admins update own tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
WITH CHECK (id = get_user_tenant_id(auth.uid()));