'use client'

import { useCallback, useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { useTelemetryRealtime } from '@/hooks/useTelemetryRealtime'
import { ManualControlPanel } from '@/components/controls/manual-control-panel'
import { TelemetryAreaChart } from '@/components/charts/telemetry-chart'
import { EnergyProductionChart } from '@/components/charts/energy-chart'
import { Sun, Wind, Crosshair, Zap, Wifi, WifiOff, TrendingUp, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  nodeId:       string
  nodeMac:      string
  nodeLabel:    string
  siteName:     string
  siteTimezone: string
}

interface EnergyBar {
  label: string
  kwh:   number
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, icon: Icon, accent = 'emerald',
}: {
  label: string; value: string | number; unit: string
  icon: LucideIcon; accent?: 'emerald' | 'amber' | 'sky'
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50',
    amber:   'text-amber-400 bg-amber-950/50 border-amber-900/50',
    sky:     'text-sky-400 bg-sky-950/50 border-sky-900/50',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="opacity-70" />
        <span className="text-xs font-mono uppercase tracking-widest opacity-60">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        <span className="text-sm opacity-60 mb-0.5">{unit}</span>
      </div>
    </div>
  )
}

// ─── HomeownerClient ──────────────────────────────────────────────────────────
// This client component receives the node ID from the server component (page.tsx)
// and subscribes to real-time telemetry via Supabase Realtime.
// MQTT credentials are never used here — commands go through /api/command.
export function HomeownerClient({ nodeId, nodeMac, nodeLabel, siteName, siteTimezone }: Props) {
  const { latest, history, isConnected, isLoading } = useTelemetryRealtime(nodeId)
  const [energyData, setEnergyData] = useState<EnergyBar[]>([])

  // ── Fetch real energy data from Supabase (today's hourly totals) ───────────
  useEffect(() => {
    const supabase = createClient()

    const fetchEnergyData = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data } = await supabase
        .from('telemetry')
        .select('irradiance, recorded_at')
        .eq('node_id', nodeId)
        .gte('recorded_at', today.toISOString())
        .order('recorded_at', { ascending: true })

      if (!data || data.length === 0) return

      // Aggregate irradiance readings into hourly kWh estimates
      // kWh = (avg irradiance W/m² × panel area ~1.8m² × efficiency ~0.18) / 1000 × hours
      const PANEL_EFFECTIVE_M2 = 1.8 * 0.18   // effective area × efficiency
      const hourlyMap: Record<number, { sum: number; count: number }> = {}

      for (const row of data) {
        const h = new Date(row.recorded_at).getHours()
        if (!hourlyMap[h]) hourlyMap[h] = { sum: 0, count: 0 }
        if (row.irradiance != null) {
          hourlyMap[h].sum   += row.irradiance
          hourlyMap[h].count += 1
        }
      }

      const bars: EnergyBar[] = Object.entries(hourlyMap).map(([hour, { sum, count }]) => ({
        label: `${hour.toString().padStart(2, '0')}:00`,
        kwh:   parseFloat(((sum / count) * PANEL_EFFECTIVE_M2 / 1000).toFixed(3)),
      }))

      setEnergyData(bars)
    }

    fetchEnergyData()
  }, [nodeId])

  // ── Command publisher — proxied through /api/command (no browser MQTT) ─────
  const publish = useCallback(async (topic: string, payload: string) => {
    try {
      const res = await fetch('/api/command', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nodeId, topic, payload }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        console.error('[Command] Failed:', error)
      }
    } catch (err) {
      console.error('[Command] Network error:', err)
    }
  }, [nodeId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    )
  }

  const lastUpdateTime = latest
    ? new Date().toLocaleTimeString()
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{siteName}</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-mono">
            {nodeLabel} · {nodeMac} · {siteTimezone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected
            ? <div className="flex items-center gap-1.5 text-xs text-emerald-400"><Wifi size={12}/> Live</div>
            : <div className="flex items-center gap-1.5 text-xs text-zinc-500"><WifiOff size={12}/> Waiting for data…</div>
          }
        </div>
      </div>

      {/* Live Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Irradiance" icon={Sun} accent="amber"
          value={latest?.solar_yield?.toFixed(0) ?? '—'} unit="W/m²"
        />
        <StatCard
          label="Wind Speed" icon={Wind} accent="sky"
          value={latest?.wind_speed?.toFixed(1) ?? '—'} unit="m/s"
        />
        <StatCard
          label="Pan Angle" icon={Crosshair} accent="emerald"
          value={latest?.panel_angle?.toFixed(1) ?? '—'} unit="°"
        />
        <StatCard
          label="Status" icon={Zap} accent="emerald"
          value={latest?.status ?? '—'} unit=""
        />
      </div>

      {/* Wind Alert Banner */}
      {latest?.wind_alert && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <Wind size={14} />
          <strong>Wind Alert Active</strong> — Panel is in emergency stow mode.
        </div>
      )}

      {/* No data yet banner */}
      {!latest && !isLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500 font-mono">
            No telemetry received yet. Ensure the SOLTRA node is powered on and configured to send data to:
          </p>
          <p className="text-xs text-emerald-500 font-mono mt-2">
            POST {process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/api/telemetry/ingest
          </p>
        </div>
      )}

      {/* Live Charts Row */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-300">Live Telemetry Stream</span>
            <span className="text-xs font-mono text-zinc-600">
              ({history.length} samples)
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <TelemetryAreaChart
              data={history}
              metric="solar_yield"
              title="Irradiance"
              unit="W/m²"
              color="#f59e0b"
              gradientId="grad-solar"
            />
            <TelemetryAreaChart
              data={history}
              metric="wind_speed"
              title="Wind Speed"
              unit="m/s"
              color="#38bdf8"
              gradientId="grad-wind"
              alertThreshold={12.5}
            />
          </div>
        </div>
      )}

      {/* Today's Energy Production */}
      {energyData.length > 0 && (
        <EnergyProductionChart data={energyData} height={180} />
      )}

      {/* Manual Control Panel */}
      <ManualControlPanel publish={publish} isConnected={isConnected} />

      {/* Status Footer */}
      <div className="text-xs text-zinc-600 font-mono">
        {lastUpdateTime ? `Last update: ${lastUpdateTime}` : 'Awaiting first telemetry packet…'}
        {' · '}Node: {nodeMac}
      </div>
    </div>
  )
}
