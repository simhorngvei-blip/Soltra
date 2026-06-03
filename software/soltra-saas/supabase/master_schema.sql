-- ============================================================
-- PROJECT SOLTRA — Master Schema (Single-File, Idempotent)
-- ============================================================
-- Apply to a fresh Supabase project with ONE command:
--   Supabase Dashboard → SQL Editor → paste this file → Run
--
-- This replaces schema.sql, phase2_rls.sql, phase2_trigger.sql,
-- and phase3_fixes.sql. Those files are kept for git history.
--
-- Order: Extensions → Enums → Tables → Indexes → Realtime
--        → Triggers → RLS → pg_cron Cleanup
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;       -- TTL cleanup jobs
-- CREATE EXTENSION IF NOT EXISTS timescaledb; -- optional for large deployments

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('homeowner', 'fleet_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM ('active', 'offline', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users via foreign key.
-- Row is auto-created by handle_new_user() trigger on auth signup.
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT              NOT NULL UNIQUE,
  role              user_role         NOT NULL DEFAULT 'homeowner',
  stripe_customer_id TEXT             UNIQUE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  full_name         TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ─── SITES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  timezone    TEXT        DEFAULT 'Asia/Kuala_Lumpur',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── NODES (Hardware Units) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nodes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  mac_address  TEXT        NOT NULL UNIQUE,  -- Hardware fingerprint (MAC of Heltec hub)
  label        TEXT,                          -- "Hub-01", "North Tracker", etc.
  status       node_status NOT NULL DEFAULT 'offline',
  firmware_ver TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TELEMETRY (Time-Series) ──────────────────────────────────────────────────
-- Populated by hardware via POST /api/telemetry/ingest (service_role key).
-- Field mapping from firmware → DB:
--   firmware: solar_yield  → DB: irradiance  (W/m²)
--   firmware: panel_angle  → DB: pan_angle   (horizontal axis °)
--   firmware: tilt_angle   → DB: tilt_angle  (vertical axis °)
--   firmware: wind_speed   → DB: wind_speed  (m/s)
CREATE TABLE IF NOT EXISTS public.telemetry (
  id          BIGSERIAL   PRIMARY KEY,
  node_id     UUID        NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  watts       REAL,        -- Power output (W) — reserved, not sent by firmware yet
  volts       REAL,        -- Panel voltage (V)
  pan_angle   REAL,        -- Horizontal axis angle (°)
  tilt_angle  REAL,        -- Vertical axis angle (°)
  wind_speed  REAL,        -- Wind speed (m/s)
  irradiance  REAL,        -- Solar irradiance (W/m²)
  humidity    REAL,        -- Relative humidity (%) from BME280
  wind_alert  BOOLEAN     DEFAULT FALSE,
  node_status TEXT         -- Status string from firmware ("tracking", "stow", etc.)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_owner_id
  ON public.sites (owner_id);

CREATE INDEX IF NOT EXISTS idx_nodes_site_id
  ON public.nodes (site_id);

-- Telemetry ingest looks up node by MAC on every hardware POST
CREATE INDEX IF NOT EXISTS idx_nodes_mac_address
  ON public.nodes (mac_address);

-- Time-range queries always filter by node + time descending
CREATE INDEX IF NOT EXISTS idx_telemetry_node_recorded
  ON public.telemetry (node_id, recorded_at DESC);

-- ─── Supabase Realtime ────────────────────────────────────────────────────────
-- Required for useTelemetryRealtime.ts and useFleetRealtime.ts browser hooks.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── updated_at Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated ON public.users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_sites_updated ON public.sites;
CREATE TRIGGER trg_sites_updated
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_nodes_updated ON public.nodes;
CREATE TRIGGER trg_nodes_updated
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Auto-create user profile on signup ──────────────────────────────────────
-- Reads 'role' from signup metadata (set by the registration form).
-- Defaults to 'homeowner' if metadata is missing or invalid.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role user_role;
BEGIN
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
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: ignore if row already exists
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RLS: Enable on all tables ────────────────────────────────────────────────
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

-- Drop any old catch-all policies before creating granular ones
DROP POLICY IF EXISTS "users_self"          ON public.users;
DROP POLICY IF EXISTS "sites_owner"         ON public.sites;
DROP POLICY IF EXISTS "nodes_via_site"      ON public.nodes;
DROP POLICY IF EXISTS "telemetry_via_node"  ON public.telemetry;

-- ─── RLS: USERS ──────────────────────────────────────────────────────────────
-- Users can only read and update their own profile row.
-- INSERT is handled by the trigger (SECURITY DEFINER — bypasses RLS).
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── RLS: SITES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sites_select_own" ON public.sites;
CREATE POLICY "sites_select_own" ON public.sites
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'fleet_admin'
    )
  );

DROP POLICY IF EXISTS "sites_insert_own" ON public.sites;
CREATE POLICY "sites_insert_own" ON public.sites
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "sites_update_own" ON public.sites;
CREATE POLICY "sites_update_own" ON public.sites
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "sites_delete_own" ON public.sites;
CREATE POLICY "sites_delete_own" ON public.sites
  FOR DELETE USING (owner_id = auth.uid());

-- ─── RLS: NODES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "nodes_select_via_site" ON public.nodes;
CREATE POLICY "nodes_select_via_site" ON public.nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = nodes.site_id
        AND (
          s.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'fleet_admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "nodes_insert_via_site" ON public.nodes;
CREATE POLICY "nodes_insert_via_site" ON public.nodes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "nodes_update_via_site" ON public.nodes;
CREATE POLICY "nodes_update_via_site" ON public.nodes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = nodes.site_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "nodes_delete_via_site" ON public.nodes;
CREATE POLICY "nodes_delete_via_site" ON public.nodes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = nodes.site_id AND s.owner_id = auth.uid()
    )
  );

-- ─── RLS: TELEMETRY ──────────────────────────────────────────────────────────
-- Telemetry is written by the service_role key (hardware POST via Next.js API).
-- End users can only SELECT rows for nodes they own.
DROP POLICY IF EXISTS "telemetry_select_via_node" ON public.telemetry;
CREATE POLICY "telemetry_select_via_node" ON public.telemetry
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.sites s ON s.id = n.site_id
      WHERE n.id = telemetry.node_id
        AND (
          s.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'fleet_admin'
          )
        )
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated users — hardware writes via service_role only.

-- ─── pg_cron: Telemetry TTL Cleanup ──────────────────────────────────────────
-- Runs daily at 03:00 UTC. Deletes telemetry older than 30 days.
-- Prevents the free Supabase tier (500MB) from being exhausted.
-- At 5s intervals × 1 node = ~17,280 rows/day × 30 days = ~518,400 rows ≈ ~100MB
SELECT cron.schedule(
  'soltra-telemetry-cleanup',   -- job name (idempotent)
  '0 3 * * *',                  -- daily at 03:00 UTC
  $$
    DELETE FROM public.telemetry
    WHERE recorded_at < NOW() - INTERVAL '30 days';
  $$
);

-- ─── Verification ────────────────────────────────────────────────────────────
-- After applying, run this to confirm everything:
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
--
-- SELECT jobname, schedule, command FROM cron.job;
