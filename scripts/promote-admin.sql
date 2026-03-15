-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Promote User to Super Admin
--
-- USAGE:
--   1. User registers at the app login page
--   2. User confirms their email (check Supabase Auth > Users)
--   3. Copy their user UUID from Supabase Auth dashboard
--   4. Replace USER_UUID_HERE below with the actual UUID
--   5. Run this SQL in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Step 1: Set the user UUID (replace with actual value)
DO $$
DECLARE
  v_user_id uuid := 'USER_UUID_HERE';  -- ← REPLACE THIS
  v_tenant_id uuid := 'a0000000-0000-0000-0000-000000000001'; -- Default tenant (AION Main)
  v_profile_exists boolean;
  v_role_exists boolean;
BEGIN
  -- Verify user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User % not found in auth.users. Check the UUID.', v_user_id;
  END IF;

  -- Check if profile exists (should be auto-created by handle_new_user trigger)
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    -- Create profile manually if trigger didn't fire
    INSERT INTO public.profiles (id, tenant_id, full_name, email)
    SELECT v_user_id, v_tenant_id,
           COALESCE(raw_user_meta_data->>'full_name', email),
           email
    FROM auth.users WHERE id = v_user_id;
    RAISE NOTICE 'Profile created for user %', v_user_id;
  ELSE
    -- Ensure profile is linked to the correct tenant
    UPDATE public.profiles
    SET tenant_id = v_tenant_id
    WHERE id = v_user_id AND (tenant_id IS NULL OR tenant_id != v_tenant_id);
    RAISE NOTICE 'Profile already exists, tenant verified';
  END IF;

  -- Check if role exists
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'super_admin') INTO v_role_exists;

  IF NOT v_role_exists THEN
    -- Remove any existing roles for this user
    DELETE FROM public.user_roles WHERE user_id = v_user_id;

    -- Assign super_admin role
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_user_id, v_tenant_id, 'super_admin');
    RAISE NOTICE 'super_admin role assigned to user %', v_user_id;
  ELSE
    RAISE NOTICE 'User % already has super_admin role', v_user_id;
  END IF;

  RAISE NOTICE 'DONE — User % is now super_admin for tenant AION Main', v_user_id;
END $$;
