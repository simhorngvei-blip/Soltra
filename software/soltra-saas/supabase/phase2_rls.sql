-- ============================================================
-- PROJECT SOLTRA — Phase 2: Granular RLS Policies
-- Run this in your Supabase SQL Editor AFTER the base schema.
--
-- If the base schema was already executed, the tables + RLS
-- enablement already exist. This script DROPS the Phase 1
-- catch-all policies and replaces them with proper granular ones.
-- ============================================================

-- ─── 1. DROP EXISTING CATCH-ALL POLICIES ─────────────────────────────────────
DROP POLICY IF EXISTS "users_self"          ON public.users;
DROP POLICY IF EXISTS "sites_owner"         ON public.sites;
DROP POLICY IF EXISTS "nodes_via_site"      ON public.nodes;
DROP POLICY IF EXISTS "telemetry_via_node"  ON public.telemetry;

-- ============================================================
-- 2. USERS TABLE — Self-service only
-- ============================================================
-- Users can read their own profile
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (name, avatar — not role or tier)
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert handled by the on_auth_user_created trigger (SECURITY DEFINER)
-- No direct INSERT policy needed for end users.
-- DELETE: users cannot delete their own profile via the API.

-- ============================================================
-- 3. SITES TABLE — Owner CRUD + fleet_admin read-all
-- ============================================================
-- Homeowners see only their own sites
CREATE POLICY "sites_select_own" ON public.sites
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'fleet_admin'
    )
  );

-- Homeowners can create sites assigned to themselves
CREATE POLICY "sites_insert_own" ON public.sites
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Homeowners can update their own sites
CREATE POLICY "sites_update_own" ON public.sites
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Homeowners can delete their own sites (cascades nodes + telemetry)
CREATE POLICY "sites_delete_own" ON public.sites
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- 4. NODES TABLE — Access via site ownership chain
-- ============================================================
-- Helper: "Does the current user own the site this node belongs to?"
-- (Or is the user a fleet_admin?)

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

CREATE POLICY "nodes_insert_via_site" ON public.nodes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "nodes_update_via_site" ON public.nodes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = nodes.site_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "nodes_delete_via_site" ON public.nodes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = nodes.site_id AND s.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 5. TELEMETRY TABLE — Read via node → site → user chain
-- ============================================================
-- Telemetry is INSERT-only from the Heltec (via service_role key).
-- End users can only SELECT telemetry for nodes they own.

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

-- No INSERT/UPDATE/DELETE policies for telemetry via anon/authenticated.
-- Telemetry writes should come from your backend or edge function
-- using the service_role key (bypasses RLS).

-- ============================================================
-- 6. VERIFICATION QUERIES (run after applying)
-- ============================================================
-- Check that all policies were created:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
