'use client'

import { useState, useMemo } from 'react'
import type { Node } from '@/lib/types'
import { useFleetRealtime } from '@/hooks/useFleetRealtime'
import { Wind, Zap, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface EnrichedNode extends Node {
  siteName: string
}

interface FleetTelemetryTableProps {
  nodes: EnrichedNode[]
}

// ─── Fleet Telemetry Table ────────────────────────────────────────────────────
// Uses a single Supabase Realtime subscription for all nodes (via useFleetRealtime),
// replacing the previous pattern of one MQTT connection per table row.
export function FleetTelemetryTable({ nodes }: FleetTelemetryTableProps) {
  const [filter, setFilter] = useState('')

  // Extract all node IDs for the realtime subscription
  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes])
  const { nodeData, isConnected } = useFleetRealtime(nodeIds)

  const filtered = nodes.filter((n) =>
    (n.label ?? n.mac_address).toLowerCase().includes(filter.toLowerCase()) ||
    n.siteName.toLowerCase().includes(filter.toLowerCase())
  )

  const statusColor: Record<string, string> = {
    active:      'bg-emerald-500',
    offline:     'bg-zinc-600',
    maintenance: 'bg-amber-500',
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Fleet Telemetry</span>
          <span className="text-xs text-zinc-500 font-mono">({nodes.length} nodes)</span>
          {isConnected
            ? <span className="text-[10px] font-mono text-emerald-500">● LIVE</span>
            : <span className="text-[10px] font-mono text-zinc-600">○ Connecting…</span>
          }
        </div>
        <input
          type="text"
          placeholder="Filter nodes…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Node / Site', 'Feed', 'Irradiance', 'Wind', 'Pan Angle', 'Status'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-zinc-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">
                  No nodes found
                </td>
              </tr>
            ) : (
              filtered.map((node) => {
                const telemetry = nodeData[node.id] ?? null
                const hasLive   = telemetry !== null

                return (
                  <tr
                    key={node.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    {/* Node / Site */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${statusColor[node.status] ?? 'bg-zinc-600'}`} />
                        <span className="font-mono text-sm text-zinc-200">
                          {node.label ?? node.mac_address}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 mt-0.5 block">{node.siteName}</span>
                    </td>

                    {/* Live indicator */}
                    <td className="px-4 py-3">
                      {hasLive
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Wifi size={10}/> Live</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><WifiOff size={10}/> —</span>
                      }
                    </td>

                    {/* Irradiance */}
                    <td className="px-4 py-3 font-mono text-sm text-amber-400">
                      {telemetry?.solar_yield?.toFixed(1) ?? '—'} W/m²
                    </td>

                    {/* Wind */}
                    <td className="px-4 py-3 font-mono text-sm text-sky-400">
                      <span className="flex items-center gap-1">
                        {telemetry?.wind_alert && <AlertTriangle size={12} className="text-red-400" />}
                        {telemetry?.wind_speed?.toFixed(1) ?? '—'} m/s
                      </span>
                    </td>

                    {/* Pan Angle */}
                    <td className="px-4 py-3 font-mono text-sm text-emerald-400">
                      {telemetry?.panel_angle?.toFixed(1) ?? '—'}°
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">
                      {telemetry?.status ?? node.status}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
