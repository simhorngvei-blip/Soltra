import { createClient } from '@/lib/supabase/server'
import { FleetTelemetryTable } from '@/components/fleet/fleet-telemetry-table'
import { FleetMapPlaceholder } from '@/components/fleet/fleet-map-placeholder'
import { FleetBulkCommandPanel } from '@/components/fleet/fleet-bulk-commands'
import type { Metadata } from 'next'
import type { Node, Site } from '@/lib/types'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Fleet Command' }

async function getFleetData() {
  const supabase = await createClient()

  const [sitesResult, nodesResult] = await Promise.all([
    supabase.from('sites').select('*').order('created_at', { ascending: false }),
    supabase.from('nodes').select('*, sites(name)').order('created_at', { ascending: false }),
  ])

  const enrichedNodes = (nodesResult.data ?? []).map((n: any) => ({
    ...n,
    siteName: n.sites?.name ?? 'Unknown Site',
    sites: undefined,
  }))

  return {
    sites:    (sitesResult.data ?? []) as Site[],
    nodes:    enrichedNodes as (Node & { siteName: string })[],
    hasError: !!(sitesResult.error || nodesResult.error),
  }
}

export default async function FleetPage() {
  const { sites, nodes, hasError } = await getFleetData()

  if (hasError) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-10 text-center max-w-md">
          <div className="text-3xl mb-4">⚠</div>
          <h2 className="text-lg font-semibold text-red-400 mb-2">Unable to load fleet data</h2>
          <p className="text-sm text-zinc-500 font-mono mb-6">The database is currently unreachable. Please check your connection and try again.</p>
          <a href="/dashboard/fleet" className="inline-block rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-mono text-zinc-300 transition-colors">
            ↺ Retry
          </a>
        </div>
      </div>
    )
  }

  // Empty state — no nodes registered yet
  if (nodes.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-[70vh]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center max-w-md space-y-5">
          <div className="text-5xl">⚡</div>
          <h2 className="text-xl font-semibold text-zinc-200">No nodes in your fleet yet</h2>
          <p className="text-sm text-zinc-500 font-mono">
            Register your first installation site and hardware node to start monitoring your fleet.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-sm font-semibold transition-all active:scale-95"
          >
            Add Your First Site →
          </Link>
          <p className="text-[10px] text-zinc-700 font-mono">You can add more sites and nodes at any time from the sidebar.</p>
        </div>
      </div>
    )
  }

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
            {sites.length} site{sites.length !== 1 ? 's' : ''} · {nodes.length} node{nodes.length !== 1 ? 's' : ''} registered
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-center">
            <div className="text-xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-center">
            <div className="text-xl font-bold text-zinc-400">{offlineCount}</div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Offline</div>
          </div>
          <Link
            href="/dashboard/onboarding"
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            + Add Site
          </Link>
        </div>
      </div>

      {/* Map */}
      <FleetMapPlaceholder sites={sites} nodes={nodes} />

      {/* Live Telemetry Table */}
      <FleetTelemetryTable nodes={nodes} />

      {/* Bulk Command Panel */}
      <FleetBulkCommandPanel />
    </div>
  )
}
