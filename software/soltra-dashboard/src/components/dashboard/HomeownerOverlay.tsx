'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { useTelemetryRealtime } from '@/hooks/useTelemetryRealtime'
import { ManualControlPanel } from '@/components/controls/manual-control-panel'
import { TelemetryAreaChart } from '@/components/charts/telemetry-chart'
import { EnergyProductionChart } from '@/components/charts/energy-chart'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { Sun, Wind, Crosshair, Zap, Wifi, WifiOff, TrendingUp, Loader2, AlertCircle, Camera, CameraOff, Video, Play, Square, Download, Volume2, Battery, Droplets, Activity, Gauge, SunMedium, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTTS } from '@/hooks/useTTS'
import { LocalSensorNodes } from '@/components/dashboard/local-sensor-nodes'

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

// ─── HomeownerOverlay ──────────────────────────────────────────────────────────
export function HomeownerOverlay({ nodeId, nodeMac, nodeLabel, siteName, siteTimezone }: Props) {
  const { latest, history, isConnected, isLoading, error } = useTelemetryRealtime(nodeId)
  const [energyData, setEnergyData] = useState<EnergyBar[]>([])
  const [wasConnected, setWasConnected] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [snapshotWeather, setSnapshotWeather] = useState<{ weather: string; reasoning: string; confidence: number } | null>(null)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isStreamActive, setIsStreamActive] = useState(false)
  const [isCvActive, setIsCvActive] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const { speak, isGenerating } = useTTS()

  // ── Fetch Latest Snapshot ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const fetchSnapshot = async (imagePath?: string, detections?: any) => {
      setIsLoadingSnapshot(true)
      let path = imagePath
      let eventDetections = detections

      if (!path) {
        const { data } = await supabase
          .from('camera_events')
          .select('image_path, detections')
          .eq('node_id', nodeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (data) {
          path = data.image_path
          eventDetections = data.detections
        }
      }

      if (path) {
        const { data: urlData } = await supabase.storage
          .from('camera-snapshots')
          .createSignedUrl(path, 60 * 60) // 1 hour
        if (urlData) {
          setSnapshotUrl(urlData.signedUrl)
          setSnapshotWeather(eventDetections || null)
          setImageLoaded(false)
        }
      }
      setIsLoadingSnapshot(false)
    }

    fetchSnapshot()

    const channel = supabase
      .channel(`camera_events_${nodeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'camera_events', filter: `node_id=eq.${nodeId}` },
        (payload) => fetchSnapshot(payload.new.image_path, payload.new.detections)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [nodeId])

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
    if (isConnected) queueMicrotask(() => setWasConnected(true))
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

  const handleRequestSnapshot = () => {
    publish(`soltra/camera/${nodeMac}/cmd`, 'SNAPSHOT')
    toast('Snapshot requested. It will appear shortly.', 'success')
  }

  const toggleStream = () => {
    if (isCvActive) {
      setIsCvActive(false)
    }
    const newStatus = !isStreamActive
    publish(`soltra/camera/${nodeMac}/cmd`, newStatus ? 'STREAM_ON' : 'STREAM_OFF')
    setIsStreamActive(newStatus)
    toast(newStatus ? 'Starting live stream...' : 'Stream stopped to save power.', 'success')
  }

  const toggleCvStream = async () => {
    const newStatus = !isCvActive
    try {
      // Call our server-side proxy to avoid CORS/ngrok preflight issues
      const res = await fetch('/api/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newStatus ? 'start' : 'stop' }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        toast(error ?? 'Could not contact CV Backend. Is the tunnel running?', 'error')
        return
      }

      setIsCvActive(newStatus)
      if (newStatus && !isStreamActive) {
        setIsStreamActive(true) // Render the video tag
      }
      toast(newStatus ? 'Started CV Tracking...' : 'Stopped CV Tracking.', 'success')
    } catch (err) {
      toast('Could not contact CV Backend. Is the tunnel running?', 'error')
    }
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!history || history.length === 0) {
      toast('No telemetry data available to export.', 'error')
      return
    }
    // Create CSV header
    const headers = [
      'Timestamp',
      'Energy Generation (W)',
      'Panel Voltage (V)',
      'Irradiance (W/m²)',
      'Wind Speed (m/s)',
      'Panel Angle (°)',
      'LDR / Lux',
      'UV Index',
      'Humidity (%)',
      'Battery (%)',
      'Status'
    ]
    
    // Create CSV rows
    const rows = history.map(row => [
      row.recorded_at ? new Date(row.recorded_at).toLocaleString() : '',
      row.watts?.toFixed(2) ?? '',
      row.volts?.toFixed(2) ?? '',
      row.solar_yield?.toFixed(2) ?? '',
      row.wind_speed?.toFixed(2) ?? '',
      row.panel_angle?.toFixed(2) ?? '',
      row.lux?.toString() ?? '',
      row.uv_index?.toString() ?? '',
      row.humidity?.toString() ?? '',
      row.battery_pct?.toFixed(1) ?? '',
      row.status ?? ''
    ])
    // Join all together
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    
    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `soltra-telemetry-${nodeMac}-${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast('Data exported to CSV', 'success')
  }

  // ── TTS Daily Report ────────────────────────────────────────────────────────
  const handleTTSReport = () => {
    if (isGenerating) return

    const totalEnergyStr = energyData.reduce((sum, bar) => sum + bar.kwh, 0).toFixed(2)
    const maxWind = history.length > 0 
      ? Math.max(...history.map(h => h.wind_speed ?? 0)).toFixed(1)
      : '0'
    const statusText = friendlyStatus(latest?.status)

    const reportText = `Good day. Your Soltra tracking array at ${siteName} is currently ${statusText}. Today, you have generated approximately ${totalEnergyStr} kilowatt-hours of solar energy. The maximum wind speed detected was ${maxWind} meters per second. All systems are functioning nominally.`

    toast('Generating audio report...', 'success')
    speak(reportText).catch(() => {
      // Errors are handled by the hook
    })
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <Loader2 size={32} className="text-emerald-500 animate-spin" />
      </div>
    )
  }

  // Supabase fetch error
  if (error) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="rounded-xl border border-red-900/50 bg-red-950/80 p-10 text-center max-w-md space-y-4 pointer-events-auto backdrop-blur-md">
          <AlertCircle className="mx-auto text-red-400" size={32} />
          <h2 className="text-lg font-semibold text-red-400">Unable to load telemetry</h2>
          <p className="text-sm text-zinc-300 font-mono break-words">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-red-700 bg-red-900 hover:bg-red-800 px-4 py-2 text-xs font-mono text-red-100 transition-colors"
          >
            ↺ Retry
          </button>
        </div>
      </div>
    )
  }

  const lastUpdateTime = latest?.timestamp ?? null

  return (
    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none p-4 md:p-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start w-full h-full gap-8 max-w-[1800px] mx-auto">
        
        {/* =========================================
            LEFT COLUMN
            ========================================= */}
        <div className="w-full md:w-[350px] lg:w-[400px] xl:w-[450px] flex flex-col gap-6 pointer-events-auto h-full overflow-y-auto pr-2 custom-scrollbar pb-24 mask-image-bottom">
          
          {/* Header */}
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">{siteName}</h1>
              <p className="text-sm text-zinc-500 mt-0.5 font-mono">
                {nodeLabel} · {nodeMac}
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
                    className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-md border border-emerald-900/50"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live Connection
                  </motion.div>
                ) : (
                  <motion.div
                    key="disconnected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-800"
                  >
                    <WifiOff size={12}/> Waiting for data…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Live Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Power" icon={Zap} accent="amber"
              value={latest?.watts?.toFixed(1) ?? '—'} unit="W"
            />
            <StatCard
              label="Voltage" icon={Activity} accent="emerald"
              value={latest?.volts?.toFixed(1) ?? '—'} unit="V"
            />
            <StatCard
              label="Irradiance" icon={Sun} accent="amber"
              value={latest?.solar_yield?.toFixed(0) ?? '—'} unit="W/m²"
            />
            <StatCard
              label="LDR / Lux" icon={Lightbulb} accent="amber"
              value={latest?.lux?.toFixed(0) ?? '—'} unit="lux"
            />
            <StatCard
              label="UV Index" icon={SunMedium} accent="amber"
              value={latest?.uv_index?.toFixed(1) ?? '—'} unit=""
            />
            <StatCard
              label="Wind Speed" icon={Wind} accent="sky"
              value={latest?.wind_speed?.toFixed(1) ?? '—'} unit="m/s"
            />
            <StatCard
              label="Humidity" icon={Droplets} accent="sky"
              value={latest?.humidity?.toFixed(1) ?? '—'} unit="%"
            />
            <StatCard
              label="Battery" icon={Battery} accent="emerald"
              value={latest?.battery_pct?.toFixed(0) ?? '—'} unit="%"
            />
            <StatCard
              label="Pan Angle" icon={Crosshair} accent="emerald"
              value={latest?.panel_angle?.toFixed(1) ?? '—'} unit="°"
            />
            <StatCard
              label="Status" icon={Activity} accent="emerald"
              value={friendlyStatus(latest?.status)} unit=""
            />
          </div>

          {/* Today's Energy Production */}
          {energyData.length > 0 && (
            <EnergyProductionChart data={energyData} height={180} />
          )}

          {/* Local Sensor Nodes (Ported from localhost:5173) */}
          <LocalSensorNodes />

          {/* Status Footer */}
          <div className="text-xs text-zinc-600 font-mono mt-4">
            {lastUpdateTime ? `Last telemetry: ${lastUpdateTime}` : 'Awaiting first telemetry packet…'}
          </div>
        </div>

        {/* =========================================
            RIGHT COLUMN
            ========================================= */}
        <div className="w-full md:w-[350px] lg:w-[400px] xl:w-[450px] flex flex-col gap-6 pointer-events-auto h-full overflow-y-auto pl-2 custom-scrollbar pb-24 mask-image-bottom">
          
          {/* Camera Stream & Snapshots */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shrink-0">
            <div className="px-3 py-2.5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 flex-wrap gap-2">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 shrink-0">
                {isStreamActive ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    {isCvActive ? 'Live CV Tracking' : 'Live MJPEG Stream'}
                  </>
                ) : (
                  <>
                    <Camera size={12} className="text-zinc-500" />
                    Latest S3 Snapshot
                  </>
                )}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={toggleStream}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded transition-colors ${
                    isStreamActive && !isCvActive
                      ? 'bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-900/50' 
                      : 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-900/50'
                  }`}
                >
                  {isStreamActive && !isCvActive ? <><Square size={10} /> Stop Raw</> : <><Play size={10} /> Raw Stream</>}
                </button>
                <button
                  onClick={toggleCvStream}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded transition-colors ${
                    isCvActive 
                      ? 'bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-900/50' 
                      : 'bg-indigo-950/50 text-indigo-400 hover:bg-indigo-900/50 border border-indigo-900/50'
                  }`}
                >
                  {isCvActive ? <><Square size={10} /> Stop CV</> : <><Crosshair size={10} /> Tracking</>}
                </button>
              </div>
            </div>

            <div className="aspect-video bg-black relative flex items-center justify-center">
              {isStreamActive ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={isCvActive && import.meta.env.VITE_CV_BACKEND_URL 
                    ? `${import.meta.env.VITE_CV_BACKEND_URL}/video_feed` 
                    : import.meta.env.VITE_CAMERA_STREAM_URL} 
                  alt="Live Camera Feed" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  {isLoadingSnapshot && !snapshotUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-zinc-900">
                      <Camera size={32} className="text-zinc-700" />
                    </div>
                  ) : snapshotUrl ? (
                    <>
                      {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-zinc-900">
                          <Loader2 size={24} className="text-zinc-500 animate-spin" />
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={snapshotUrl}
                        alt="Latest Camera Snapshot"
                        className={`w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setImageLoaded(true)}
                      />
                      {snapshotWeather && imageLoaded && (
                        <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/80 border border-zinc-800 text-zinc-300 p-2 rounded-md backdrop-blur-md z-10 shadow-xl">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                snapshotWeather.weather === 'UNKNOWN' ? 'bg-zinc-500' :
                                snapshotWeather.weather === 'CLEAR' ? 'bg-amber-400' :
                                snapshotWeather.weather === 'RAIN' ? 'bg-blue-400' :
                                'bg-emerald-400'
                              }`}></span>
                              Weather: {snapshotWeather.weather}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Conf: {(snapshotWeather.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed italic line-clamp-2">{snapshotWeather.reasoning}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-zinc-600 text-sm font-mono flex flex-col items-center">
                      <CameraOff size={24} className="mb-2 opacity-50" />
                      No snapshots yet
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Banners */}
          <div className="flex flex-col gap-2 shrink-0">
            <AnimatePresence>
              {latest?.wind_alert && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300 flex items-center gap-2"
                >
                  <Wind size={14} />
                  <strong>Wind Alert</strong> — Panel is in emergency stow mode.
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {wasConnected && !isConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300 flex items-center gap-2"
                >
                  <WifiOff size={14} />
                  <strong>Node offline</strong> — Connection lost. Ensure node is powered on.
                </motion.div>
              )}
            </AnimatePresence>

            {!latest && !isLoading && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-center">
                <p className="text-xs text-zinc-500 font-mono">
                  No telemetry received yet.
                </p>
              </div>
            )}
          </div>

          {/* Live Charts Row */}
          {history.length > 0 && (
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Telemetry Stream</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleTTSReport}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                    {isGenerating ? 'Gen...' : 'TTS'}
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                  >
                    <Download size={12} /> CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
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
            <TelemetryAreaChart
              data={history}
              metric="uv_index"
              title="UV Index"
              unit=""
              color="#d946ef"
              gradientId="grad-uv"
            />
            <TelemetryAreaChart
              data={history}
              metric="lux"
              title="LDR / Lux"
              unit="lux"
              color="#eab308"
              gradientId="grad-lux"
            />
            <TelemetryAreaChart
              data={history}
              metric="battery_pct"
              title="Battery"
              unit="%"
              color="#10b981"
              gradientId="grad-battery"
            />
              </div>
            </div>
          )}

          {/* Manual Control Panel */}
          <ManualControlPanel publish={publish} isConnected={isConnected} />
        </div>
      </div>
      
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
