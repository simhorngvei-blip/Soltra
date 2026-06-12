-- ============================================================
-- PROJECT SOLTRA — Supabase PostgreSQL Schema
-- Run this in your Supabase project SQL editor.
-- ============================================================

-- Enums
CREATE TYPE user_role AS ENUM ('homeowner', 'fleet_admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE node_status AS ENUM ('active', 'offline', 'maintenance');

-- Enable TimescaleDB extension for time-series (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users via foreign key
CREATE TABLE public.users (
  id                UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT         NOT NULL UNIQUE,
  role              user_role    NOT NULL DEFAULT 'homeowner',
  stripe_customer_id TEXT        UNIQUE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  full_name         TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── SITES ───────────────────────────────────────────────────────────────────
CREATE TABLE public.sites (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,                        -- e.g., "Backyard", "North Field"
  lat         DOUBLE PRECISION,                             -- GPS latitude
  lng         DOUBLE PRECISION,                             -- GPS longitude
  timezone    TEXT         DEFAULT 'Asia/Kuala_Lumpur',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── NODES (Hardware Units) ───────────────────────────────────────────────────
CREATE TABLE public.nodes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID         NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  mac_address  TEXT         NOT NULL UNIQUE,               -- Hardware fingerprint from ESP32
  label        TEXT,                                        -- e.g., "Hub-01", "Corner-4"
  status       node_status  NOT NULL DEFAULT 'offline',
  firmware_ver TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── TELEMETRY (Time-Series) ──────────────────────────────────────────────────
CREATE TABLE public.telemetry (
  id            BIGSERIAL    PRIMARY KEY,
  node_id       UUID         NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  watts         REAL,                                       -- DEPRECATED: use power_watts
  volts         REAL,                                       -- DEPRECATED: use panel_volts
  power_watts   REAL,                                       -- Power output (W)
  panel_volts   REAL,                                       -- Panel voltage (V)
  pan_angle_deg REAL,                                       -- Horizontal axis angle (°)
  tilt_angle_deg REAL,                                      -- Vertical axis angle (°)
  wind_speed_ms REAL,                                       -- Wind speed (m/s)
  irradiance_wm2 REAL,                                      -- Solar irradiance (W/m²)
  lux           INTEGER,                                    -- True Lux brightness
  uv_index      REAL,                                       -- UV Index
  battery_pct   INTEGER,                                    -- Battery level (0-100%)
  humidity_pct  REAL,                                       -- Humidity (%)
  wind_alert    BOOLEAN      DEFAULT FALSE,
  node_status   TEXT                                        -- Status string from firmware
);

-- ============================================================
-- MIGRATION: RUN THESE IF UPDATING EXISTING DATABASE
-- ============================================================
-- ALTER TABLE public.telemetry RENAME COLUMN watts TO power_watts;
-- ALTER TABLE public.telemetry RENAME COLUMN volts TO panel_volts;
-- ALTER TABLE public.telemetry RENAME COLUMN pan_angle TO pan_angle_deg;
-- ALTER TABLE public.telemetry RENAME COLUMN tilt_angle TO tilt_angle_deg;
-- ALTER TABLE public.telemetry RENAME COLUMN wind_speed TO wind_speed_ms;
-- ALTER TABLE public.telemetry RENAME COLUMN irradiance TO irradiance_wm2;
-- ALTER TABLE public.telemetry RENAME COLUMN humidity TO humidity_pct;
-- ALTER TABLE public.telemetry DROP COLUMN solar_yield;
-- ALTER TABLE public.telemetry ADD COLUMN lux INTEGER;
-- ALTER TABLE public.telemetry ADD COLUMN uv_index REAL;
-- ALTER TABLE public.telemetry ADD COLUMN battery_pct INTEGER;
-- ============================================================

-- Index for fast time-range queries per node
CREATE INDEX idx_telemetry_node_time ON public.telemetry (node_id, recorded_at DESC);

-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry  ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update their own record
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Sites: owner sees their own sites; fleet_admins see all
CREATE POLICY "sites_owner" ON public.sites
  FOR ALL USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'fleet_admin')
  );

-- Nodes: follows site ownership
CREATE POLICY "nodes_via_site" ON public.nodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND (
        s.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'fleet_admin')
      )
    )
  );

-- Telemetry: follows node → site → user chain
CREATE POLICY "telemetry_via_node" ON public.telemetry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.sites s ON s.id = n.site_id
      WHERE n.id = node_id AND (
        s.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'fleet_admin')
      )
    )
  );

-- ─── TRIGGER: auto-update updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON public.users  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sites_updated  BEFORE UPDATE ON public.sites  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_nodes_updated  BEFORE UPDATE ON public.nodes  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRIGGER: auto-create user profile on signup ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
