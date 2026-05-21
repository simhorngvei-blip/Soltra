import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/telemetry/ingest ───────────────────────────────────────────────
// Receives telemetry data from Heltec hardware and writes to Supabase.
// Uses the service_role key to bypass RLS (hardware cannot carry user JWTs).
// Authenticates via a shared TELEMETRY_INGEST_KEY in the Authorization header.
//
// Expected body (matches Heltec firmware JSON):
// {
//   node_mac:    string   — MAC address of the reporting node
//   wind_speed:  number   — Wind speed in m/s
//   solar_yield: number   — Solar irradiance in W/m²  (NOT watts output)
//   panel_angle: number   — Pan axis angle in degrees
//   tilt_angle:  number   — Tilt axis angle in degrees (optional)
//   wind_alert:  boolean  — True when wind safety stow is triggered
//   status:      string   — Node status string ("TRACKING", "STOW", etc.)
// }

const INGEST_KEY = process.env.TELEMETRY_INGEST_KEY

export async function POST(request: NextRequest) {
  // ── Auth: simple shared secret ──────────────────────────────────────────────
  const auth = request.headers.get('authorization')
  if (!INGEST_KEY || auth !== `Bearer ${INGEST_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    node_mac,
    wind_speed,
    solar_yield,  // irradiance W/m² from firmware
    panel_angle,
    tilt_angle,
    wind_alert,
    status,
  } = body as {
    node_mac:    string
    wind_speed?: number
    solar_yield?: number
    panel_angle?: number
    tilt_angle?:  number
    wind_alert?:  boolean
    status?:      string
  }

  if (!node_mac) {
    return NextResponse.json({ error: 'node_mac is required' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Ingest] Supabase credentials not configured')
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // ── Look up node by MAC address ─────────────────────────────────────────────
  const { data: node, error: nodeErr } = await supabase
    .from('nodes')
    .select('id')
    .eq('mac_address', node_mac.toUpperCase())
    .single()

  if (nodeErr || !node) {
    return NextResponse.json(
      { error: `Node not found for MAC: ${node_mac}` },
      { status: 404 }
    )
  }

  // ── Insert telemetry record ─────────────────────────────────────────────────
  // Field mapping from firmware names → DB schema names:
  //   solar_yield → irradiance  (W/m², NOT watts power output)
  //   panel_angle → pan_angle
  //   tilt_angle  → tilt_angle
  //   wind_speed  → wind_speed
  const { error: insertErr } = await supabase
    .from('telemetry')
    .insert({
      node_id:     node.id,
      irradiance:  solar_yield  ?? null,   // irradiance in W/m²
      watts:       null,                   // power output — firmware doesn't send this yet
      pan_angle:   panel_angle  ?? null,
      tilt_angle:  tilt_angle   ?? null,
      wind_speed:  wind_speed   ?? null,
      wind_alert:  wind_alert   ?? false,
      node_status: status       ?? null,
    })

  if (insertErr) {
    console.error('[Ingest] Insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── Update node heartbeat ───────────────────────────────────────────────────
  await supabase
    .from('nodes')
    .update({ last_seen_at: new Date().toISOString(), status: 'active' })
    .eq('id', node.id)

  return NextResponse.json({ ok: true })
}
