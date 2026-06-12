import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { classifyWeatherWithCascade } from '@/lib/ai/weather-classifier'

// ─── POST /api/camera/upload ────────────────────────────────────────────────
// Receives JPEG snapshots from the Soltra Camera Node and saves them to S3.
// Authenticates via a shared TELEMETRY_INGEST_KEY in the Authorization header.

const INGEST_KEY = process.env.TELEMETRY_INGEST_KEY

export async function POST(request: NextRequest) {
  // ── Auth: simple shared secret ──────────────────────────────────────────────
  const auth = request.headers.get('authorization')
  if (!INGEST_KEY || auth !== `Bearer ${INGEST_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nodeMac = request.headers.get('x-node-mac')
  if (!nodeMac) {
    return NextResponse.json({ error: 'x-node-mac header is required' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Camera Upload] Supabase credentials not configured')
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
    .eq('mac_address', nodeMac.toUpperCase())
    .single()

  if (nodeErr || !node) {
    return NextResponse.json(
      { error: `Node not found for MAC: ${nodeMac}` },
      { status: 404 }
    )
  }

  // ── Read binary image data ──────────────────────────────────────────────────
  const blob = await request.blob()
  if (!blob || blob.size === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 })
  }

  const arrayBuffer = await blob.arrayBuffer()
  const base64Image = Buffer.from(arrayBuffer).toString('base64')

  const timestamp = Date.now()
  const imagePath = `${nodeMac.toUpperCase()}/${timestamp}.jpg`

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const { error: uploadErr } = await supabase.storage
    .from('camera-snapshots')
    .upload(imagePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadErr) {
    console.error('[Camera Upload] Storage error:', uploadErr)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // ── AI Classification (Roboflow + Gemini Cascade) ───────────────────────────
  const detection = await classifyWeatherWithCascade(base64Image, 'image/jpeg')

  // ── Insert event record ─────────────────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from('camera_events')
    .insert({
      node_id: node.id,
      image_path: imagePath,
      cv_processed: true,
      detections: detection,
    })

  if (insertErr) {
    console.error('[Camera Upload] DB insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── Update node heartbeat ───────────────────────────────────────────────────
  await supabase
    .from('nodes')
    .update({ last_seen_at: new Date().toISOString(), status: 'active' })
    .eq('id', node.id)

  return NextResponse.json({ ok: true, imagePath })
}
