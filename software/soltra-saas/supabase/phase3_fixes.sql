-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 Fixes: Indexes, Realtime, Schema Patches
-- Run after schema.sql, phase2_rls.sql, phase2_trigger.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Performance Indexes ────────────────────────────────────────────────────

-- Stripe webhook looks up users by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Sites are almost always filtered by owner
CREATE INDEX IF NOT EXISTS idx_sites_owner_id
  ON public.sites (owner_id);

-- Nodes are almost always filtered by site
CREATE INDEX IF NOT EXISTS idx_nodes_site_id
  ON public.nodes (site_id);

-- Telemetry ingest looks up nodes by MAC address on every hardware POST
CREATE INDEX IF NOT EXISTS idx_nodes_mac_address
  ON public.nodes (mac_address);

-- Telemetry queries always order by recorded_at descending
CREATE INDEX IF NOT EXISTS idx_telemetry_node_recorded
  ON public.telemetry (node_id, recorded_at DESC);

-- ── 2. Enable Supabase Realtime ───────────────────────────────────────────────
-- Required for useTelemetryRealtime.ts and useFleetRealtime.ts hooks.
-- The frontend subscribes to these tables via Supabase Realtime WebSocket.

ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;

-- ── 3. Add missing stripe_customer_id column (if not present) ─────────────────
-- The schema.sql should already have this, but add it safely if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN stripe_customer_id text;
  END IF;
END $$;

-- ── 4. Ensure subscription_tier has correct default ───────────────────────────
-- Stripe webhook updates subscription_tier, which must default to 'free'.
ALTER TABLE public.users
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- ── 5. Add full_name column (if not present) ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN full_name text;
  END IF;
END $$;
