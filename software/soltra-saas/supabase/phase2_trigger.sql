-- ============================================================
-- PROJECT SOLTRA — Phase 2: Updated User Profile Trigger
-- Run this in your Supabase SQL Editor.
--
-- Replaces the Phase 1 trigger so it reads the `role` from
-- the signup metadata (user selects "homeowner" or "fleet_admin"
-- during registration on the frontend).
-- ============================================================

-- Drop the old trigger and function first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate with role awareness
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role user_role;
BEGIN
  -- Read the role from signup metadata, default to 'homeowner'
  BEGIN
    _role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'homeowner';
  END;

  INSERT INTO public.users (id, email, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    _role,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
