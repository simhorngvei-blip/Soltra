import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import mqtt from 'mqtt'

// ─── Server-side MQTT Command Publisher ──────────────────────────────────────
// Receives authenticated requests from the browser and publishes MQTT messages
// server-side. This means MQTT broker credentials NEVER reach the browser.
//
// POST /api/command
// Body: { nodeId: string, topic: string, payload: string }
// Auth: Supabase session cookie (standard Next.js auth)

const BROKER_URL = `mqtts://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT ?? '8883'}`

export async function POST(req: Request) {
  try {
    const { nodeId, topic, payload } = await req.json() as {
      nodeId:  string
      topic:   string
      payload: string
    }

    if (!nodeId || !topic || payload === undefined) {
      return NextResponse.json({ error: 'nodeId, topic, and payload are required' }, { status: 400 })
    }

    // ── Auth check: user must be authenticated ──────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Ownership check: user must own the node ─────────────────────────────
    const { data: node } = await supabase
      .from('nodes')
      .select('id, sites!inner(owner_id)')
      .eq('id', nodeId)
      .single()

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const ownerIds = (node as any).sites?.owner_id
    if (ownerIds !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Validate MQTT config is present ────────────────────────────────────
    if (!process.env.HIVEMQ_HOST || !process.env.HIVEMQ_USER || !process.env.HIVEMQ_PASS) {
      console.error('[Command API] HIVEMQ credentials not configured')
      return NextResponse.json({ error: 'MQTT not configured' }, { status: 503 })
    }

    // ── Connect, publish, disconnect (short-lived connection) ──────────────
    await publishMqttCommand(topic, payload)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[Command API] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Short-lived MQTT publish helper ─────────────────────────────────────────
function publishMqttCommand(topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end(true)
      reject(new Error('MQTT connection timed out'))
    }, 6000)

    const client = mqtt.connect(BROKER_URL, {
      username:    process.env.HIVEMQ_USER,
      password:    process.env.HIVEMQ_PASS,
      clientId:    `soltra-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clean:       true,
      reconnectPeriod: 0, // No reconnect — fail fast
    })

    client.once('connect', () => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        clearTimeout(timeout)
        client.end()
        if (err) reject(err)
        else resolve()
      })
    })

    client.once('error', (err) => {
      clearTimeout(timeout)
      client.end(true)
      reject(err)
    })
  })
}
