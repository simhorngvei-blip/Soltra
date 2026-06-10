import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/telemetry/ingest ───────────────────────────────────────────────
// Receives telemetry data from Heltec hardware and writes to Supabase.
// Uses the service_role key to bypass RLS (hardware cannot carry user JWTs).
// Authenticates via a shared TELEMETRY_INGEST_KEY in the Authorization header.
//
// Expected body (matches Soltra Master Schema):
// {
//   node_mac:       string   — MAC address of the reporting node
//   battery_pct:    number   — Battery level 0-100%
//   uv_index:       number   — UV Index
//   lux:            number   — True lux from TSL2591
//   irradiance_wm2: number   — Estimated W/m²
//   humidity_pct:   number   — Humidity %
//   power_watts:    number   — Power output in Watts
//   panel_volts:    number   — Panel voltage
//   wind_speed_ms:  number   — Wind speed in m/s
//   wind_alert:     boolean  — True when wind safety stow is triggered
//   pan_angle_deg:  number   — Pan axis angle in degrees
//   tilt_angle_deg: number   — Tilt axis angle in degrees
//   status:         string   — Node status string
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
    battery_pct,
    uv_index,
    lux,
    irradiance_wm2,
    humidity_pct,
    power_watts,
    panel_volts,
    wind_speed_ms,
    wind_alert,
    pan_angle_deg,
    tilt_angle_deg,
    status,
  } = body as {
    node_mac:        string
    battery_pct?:    number
    uv_index?:       number
    lux?:            number
    irradiance_wm2?: number
    humidity_pct?:   number
    power_watts?:    number
    panel_volts?:    number
    wind_speed_ms?:  number
    wind_alert?:     boolean
    pan_angle_deg?:  number
    tilt_angle_deg?: number
    status?:         string
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
  const { error: insertErr } = await supabase
    .from('telemetry')
    .insert({
      node_id:     node.id,
      watts:       power_watts ?? null,
      volts:       panel_volts ?? null,
      pan_angle:   pan_angle_deg ?? null,
      tilt_angle:  tilt_angle_deg ?? null,
      wind_speed:  wind_speed_ms ?? null,
      irradiance:  irradiance_wm2 ?? null,
      humidity:    humidity_pct ?? null,
      wind_alert:  wind_alert ?? false,
      node_status: status ?? null,
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
