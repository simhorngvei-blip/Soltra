'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { useTelemetryRealtime } from '@/hooks/useTelemetryRealtime'
import { ManualControlPanel } from '@/components/controls/manual-control-panel'
import { TelemetryAreaChart } from '@/components/charts/telemetry-chart'
import { EnergyProductionChart } from '@/components/charts/energy-chart'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { Sun, Wind, Crosshair, Zap, Wifi, WifiOff, TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

// ─── Status labels ────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  tracking:    'Tracking',
  stow:        'Stowed',
  stowed:      'Stowed',
  idle:        'Idle',
  active:      'Active',
  offline:     'Offline',
  maintenance: 'Maintenance',
  wind_stow:   'Wind Stow',
  boot:        'Booting',
}

function friendlyStatus(raw: string | null | undefined): string {
  if (!raw) return '—'
  return STATUS_LABELS[raw.toLowerCase()] ?? raw
}

// ─── Animated number (odometer effect) ───────────────────────────────────────
function AnimatedValue({ value }: { value: string | number }) {
  const [displayed, setDisplayed] = useState(value)
  const [flash, setFlash]         = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current !== value) {
      setFlash(true)
      const t = setTimeout(() => {
        setDisplayed(value)
        setFlash(false)
      }, 120)
      prev.current = value
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <motion.span
      key={String(value)}
      animate={flash ? { opacity: [1, 0.4, 1], y: [0, -4, 0] } : {}}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="text-3xl font-bold tabular-nums"
    >
      {displayed}
    </motion.span>
  )
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
        <AnimatedValue value={value} />
        <span className="text-sm opacity-60 mb-0.5">{unit}</span>
      </div>
    </div>
  )
}

// ─── HomeownerClient ──────────────────────────────────────────────────────────
export function HomeownerClient({ nodeId, nodeMac, nodeLabel, siteName, siteTimezone }: Props) {
  const { latest, history, isConnected, isLoading, error } = useTelemetryRealtime(nodeId)
  const [energyData, setEnergyData] = useState<EnergyBar[]>([])
  const [wasConnected, setWasConnected] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  // ── Fetch real energy data from Supabase ────────────────────────────────────
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

      const PANEL_EFFECTIVE_M2 = 1.8 * 0.18
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

  // ── Detect node going offline ───────────────────────────────────────────────
  useEffect(() => {
    if (wasConnected && !isConnected && !isLoading) {
      toast('Node connection lost. Check that the device is powered on.', 'error')
    }
    if (isConnected) setWasConnected(true)
  }, [isConnected, isLoading, wasConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Command publisher ───────────────────────────────────────────────────────
  const publish = useCallback(async (topic: string, payload: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/command', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nodeId, topic, payload }),
      })
      if (!res.ok) {
        const { error: cmdErr } = await res.json().catch(() => ({ error: 'Request failed' }))
        toast(cmdErr ?? 'Command failed. Check node connectivity.', 'error')
        return false
      }
      return true
    } catch {
      toast('Network error. Cannot reach the command server.', 'error')
      return false
    }
  }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    )
  }

  // Supabase fetch error
  if (error) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-10 text-center max-w-md space-y-4">
          <AlertCircle className="mx-auto text-red-400" size={32} />
          <h2 className="text-lg font-semibold text-red-400">Unable to load telemetry</h2>
          <p className="text-sm text-zinc-500 font-mono">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-mono text-zinc-300 transition-colors"
          >
            ↺ Retry
          </button>
        </div>
      </div>
    )
  }

  const lastUpdateTime = latest?.timestamp ?? null

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
          <AnimatePresence mode="wait">
            {isConnected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-xs text-emerald-400"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-xs text-zinc-500"
              >
                <WifiOff size={12}/> Waiting for data…
              </motion.div>
            )}
          </AnimatePresence>
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
          value={friendlyStatus(latest?.status)} unit=""
        />
      </div>

      {/* Camera Stream */}
      {process.env.NEXT_PUBLIC_CAMERA_STREAM_URL && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
           <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
             <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
               </span>
               Live Camera Feed
             </span>
           </div>
           <div className="aspect-video bg-black relative flex items-center justify-center">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
                src={process.env.NEXT_PUBLIC_CAMERA_STREAM_URL} 
                alt="Live Camera Feed" 
                className="w-full h-full object-cover"
             />
           </div>
        </div>
      )}

      {/* Wind Alert Banner */}
      <AnimatePresence>
        {latest?.wind_alert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300 flex items-center gap-2"
          >
            <Wind size={14} />
            <strong>Wind Alert Active</strong> — Panel is in emergency stow mode.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node offline banner */}
      <AnimatePresence>
        {wasConnected && !isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300 flex items-center gap-2"
          >
            <WifiOff size={14} />
            <strong>Node offline</strong> — Connection lost. Ensure the SOLTRA node is powered on and connected to the internet.
          </motion.div>
        )}
      </AnimatePresence>

      {/* No data yet banner */}
      {!latest && !isLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500 font-mono">
            No telemetry received yet. Power on your SOLTRA node and ensure it is connected to the internet.
          </p>
          <p className="text-xs text-zinc-600 font-mono mt-2">
            The dashboard will populate automatically once your node begins transmitting.
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
        {lastUpdateTime ? `Last telemetry: ${lastUpdateTime}` : 'Awaiting first telemetry packet…'}
        {' · '}Node: {nodeMac}
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
