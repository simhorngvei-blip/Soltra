import { createClient } from '@/lib/supabase/server'
import { FleetTelemetryTable } from '@/components/fleet/fleet-telemetry-table'
import { FleetMapPlaceholder } from '@/components/fleet/fleet-map-placeholder'
import { FleetBulkCommandPanel } from '@/components/fleet/fleet-bulk-commands'
import type { Metadata } from 'next'
import type { Node, Site } from '@/lib/types'

export const metadata: Metadata = { title: 'Fleet Command' }

// Fetch all sites + nodes for this user from Supabase (server-side)
async function getFleetData() {
  const supabase = await createClient()

  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: nodes } = await supabase
    .from('nodes')
    .select('*, sites(name)')
    .order('created_at', { ascending: false })

  // Flatten join so each node carries its site name
  const enrichedNodes = (nodes ?? []).map((n: any) => ({
    ...n,
    siteName: n.sites?.name ?? 'Unknown Site',
    sites: undefined,
  }))

  return {
    sites: (sites ?? []) as Site[],
    nodes: enrichedNodes as (Node & { siteName: string })[],
  }
}

export default async function FleetPage() {
  const { sites, nodes } = await getFleetData()

  const activeCount  = nodes.filter(n => n.status === 'active').length
  const offlineCount = nodes.filter(n => n.status === 'offline').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            ⚡ Fleet Command
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {sites.length} sites · {nodes.length} nodes registered
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3">
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-center">
            <div className="text-xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-center">
            <div className="text-xl font-bold text-zinc-400">{offlineCount}</div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Offline</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <FleetMapPlaceholder sites={sites} nodes={nodes} />

      {/* Live Telemetry Table */}
      <FleetTelemetryTable nodes={nodes} />

      {/* Bulk Command Panel — LIVE MQTT */}
      <FleetBulkCommandPanel />
    </div>
  )
}
