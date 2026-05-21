// ─── Supabase DB Types ────────────────────────────────────────────────────────

export type UserRole         = 'homeowner' | 'fleet_admin'
export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type NodeStatus       = 'active' | 'offline' | 'maintenance'

export interface SoltraUser {
  id:                string
  email:             string
  role:              UserRole
  stripe_customer_id: string | null
  subscription_tier:  SubscriptionTier
  full_name:          string | null
  avatar_url:         string | null
  created_at:         string
}

export interface Site {
  id:         string
  owner_id:   string
  name:       string
  lat:        number | null
  lng:        number | null
  timezone:   string
  created_at: string
}

export interface Node {
  id:           string
  site_id:      string
  mac_address:  string
  label:        string | null
  status:       NodeStatus
  firmware_ver: string | null
  last_seen_at: string | null
  created_at:   string
}

export interface TelemetryRecord {
  id:          number
  node_id:     string
  recorded_at: string
  watts:       number | null
  volts:       number | null
  pan_angle:   number | null
  tilt_angle:  number | null
  wind_speed:  number | null
  irradiance:  number | null    // solar irradiance W/m² (from firmware solar_yield)
  wind_alert:  boolean
  node_status: string | null
}

// ─── Normalized Telemetry ─────────────────────────────────────────────────────
// A unified shape used by UI components that can be populated from either
// the DB (TelemetryRecord) or the original MQTT LiveTelemetry payload.
// This type matches the field names expected by TelemetryAreaChart.

export interface NormalizedTelemetry {
  timestamp:   string          // HH:MM:SS for chart x-axis
  solar_yield: number | null   // irradiance W/m²
  wind_speed:  number | null   // m/s
  panel_angle: number | null   // degrees
  wind_alert:  boolean
  status:      string | null
}

/** Convert a DB TelemetryRecord to NormalizedTelemetry for chart consumption */
export function adaptTelemetryRecord(record: TelemetryRecord): NormalizedTelemetry {
  return {
    timestamp:   new Date(record.recorded_at).toLocaleTimeString('en-US', {
      hour12:  false,
      hour:    '2-digit',
      minute:  '2-digit',
      second:  '2-digit',
    }),
    solar_yield: record.irradiance,
    wind_speed:  record.wind_speed,
    panel_angle: record.pan_angle,
    wind_alert:  record.wind_alert,
    status:      record.node_status,
  }
}

// ─── Live MQTT Payload (matches Heltec firmware JSON) ─────────────────────────
// Note: This is kept for backward-compatibility with the dashboard app.
// The SaaS frontend now uses NormalizedTelemetry from Supabase Realtime instead.
export interface LiveTelemetry {
  wind_speed:  number
  solar_yield: number   // irradiance W/m²
  panel_angle: number
  wind_alert:  boolean
  light_level: number
  node_online: boolean
  status:      string
}

// ─── Dashboard / onboarding ───────────────────────────────────────────────────
export interface SiteWithNodes extends Site {
  nodes: Node[]
}
