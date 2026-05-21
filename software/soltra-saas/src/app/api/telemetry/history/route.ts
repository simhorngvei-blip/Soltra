import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/telemetry/history?node_id=xxx&hours=24
 *
 * Returns historical telemetry for a specific node.
 * Authenticated via Supabase session (RLS enforced).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('node_id')
  const hours  = parseInt(searchParams.get('hours') ?? '24', 10)
  const limit  = parseInt(searchParams.get('limit') ?? '500', 10)

  if (!nodeId) {
    return NextResponse.json({ error: 'node_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('telemetry')
    .select('recorded_at, watts, irradiance, pan_angle, wind_speed, wind_alert, node_status')
    .eq('node_id', nodeId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(Math.min(limit, 2000))

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count: data?.length ?? 0 })
}
