import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = getCorsHeaders();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const ALLOWED_ROLES = ['operator', 'viewer', 'auditor', 'tenant_admin'];

function generateTempPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let pw = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) pw += chars[arr[i] % chars.length];
  return pw;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authErr } = await callerClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) return jsonResponse({ error: 'Unauthorized' }, 401);

    const callerId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims as any).email as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const { data: callerRoles } = await adminClient
      .from('user_roles').select('role').eq('user_id', callerId);

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin');
    const isAdmin = callerRoles?.some(r => r.role === 'super_admin' || r.role === 'tenant_admin');
    if (!isAdmin) return jsonResponse({ error: 'Forbidden: admin role required' }, 403);

    // Get caller's tenant
    const { data: callerProfile } = await adminClient
      .from('profiles').select('tenant_id').eq('user_id', callerId).single();
    if (!callerProfile) return jsonResponse({ error: 'Caller profile not found' }, 400);
    const callerTenantId = callerProfile.tenant_id;

    const body = await req.json();
    const { action } = body;

    if (action === 'invite') {
      const { email, full_name, role } = body;

      // Validate email
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return jsonResponse({ error: 'Valid email is required' }, 400);
      }

      // Validate role
      const assignRole = role || 'operator';
      if (!ALLOWED_ROLES.includes(assignRole)) {
        return jsonResponse({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` }, 400);
      }
      // Only super_admin can create tenant_admin
      if (assignRole === 'tenant_admin' && !isSuperAdmin) {
        return jsonResponse({ error: 'Only super_admin can assign tenant_admin role' }, 403);
      }

      const tempPassword = generateTempPassword();

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });

      if (createError) return jsonResponse({ error: createError.message }, 400);

      // Assign role within caller's tenant
      if (assignRole !== 'operator' && newUser.user) {
        await adminClient.from('user_roles').update({ role: assignRole }).eq('user_id', newUser.user.id);
      }

      // Generate magic link for activation
      const { data: inviteData } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/dashboard` },
      });

      const activationLinkGenerated = !!inviteData?.properties?.action_link;

      // Audit log
      await adminClient.from('audit_logs').insert({
        user_id: callerId,
        user_email: callerEmail,
        tenant_id: callerTenantId,
        action: 'user_invited',
        entity_type: 'user',
        entity_id: newUser.user?.id,
        after_state: {
          invited_email: email,
          role: assignRole,
          full_name: full_name || email,
          activation_link_generated: activationLinkGenerated,
        },
      });

      // SECURITY: Never return temp_password or activation_link in the response.
      // In production, credentials are delivered via email only.
      return jsonResponse({
        success: true,
        user_id: newUser.user?.id,
        role: assignRole,
        activation_link_sent: activationLinkGenerated,
        message: `User invited. Credentials will be delivered to ${email} via email.`,
      });
    }

    if (action === 'update_role') {
      const { user_id, role } = body;

      if (!user_id || typeof user_id !== 'string') return jsonResponse({ error: 'user_id is required' }, 400);
      if (!role || !ALLOWED_ROLES.includes(role)) {
        return jsonResponse({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` }, 400);
      }
      if (role === 'tenant_admin' && !isSuperAdmin) {
        return jsonResponse({ error: 'Only super_admin can assign tenant_admin role' }, 403);
      }
      // Prevent self-demotion
      if (user_id === callerId) return jsonResponse({ error: 'Cannot change your own role' }, 400);

      // Verify target user belongs to caller's tenant
      const { data: targetProfile } = await adminClient
        .from('profiles').select('tenant_id').eq('user_id', user_id).single();
      if (!targetProfile || targetProfile.tenant_id !== callerTenantId) {
        return jsonResponse({ error: 'User not found in your tenant' }, 404);
      }

      // Get before state for audit
      const { data: beforeRole } = await adminClient
        .from('user_roles').select('role').eq('user_id', user_id).eq('tenant_id', callerTenantId).single();

      await adminClient.from('user_roles').delete()
        .eq('user_id', user_id).eq('tenant_id', callerTenantId);

      const { error } = await adminClient.from('user_roles')
        .insert({ user_id, tenant_id: callerTenantId, role });

      if (error) return jsonResponse({ error: error.message }, 400);

      // Audit log
      await adminClient.from('audit_logs').insert({
        user_id: callerId,
        user_email: callerEmail,
        tenant_id: callerTenantId,
        action: 'user_role_updated',
        entity_type: 'user',
        entity_id: user_id,
        before_state: { role: beforeRole?.role || 'unknown' },
        after_state: { role },
      });

      return jsonResponse({ success: true, role });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') return jsonResponse({ error: 'Unauthorized' }, 401);
    console.error('admin-users error:', err);
    return jsonResponse({ error: 'An error occurred' }, 500);
  }
});
