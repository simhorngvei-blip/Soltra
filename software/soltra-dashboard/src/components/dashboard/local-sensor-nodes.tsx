'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocalNodesMqtt, type LocalNodeData } from '@/hooks/useLocalNodesMqtt'
import { Sun, Battery, Activity, Wifi, WifiOff } from 'lucide-react'

const POSITION_LABELS: Record<number, string> = { 1: 'Top', 2: 'Right', 3: 'Bottom', 4: 'Left' }
const POSITION_ICONS: Record<number, string>  = { 1: '↑', 2: '→', 3: '↓', 4: '←' }

function NodeCard({ id, data }: { id: number; data: LocalNodeData }) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (data.lastSeen) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [data.lastSeen])

  const isOnline = data.lastSeen && (Date.now() - data.lastSeen.getTime()) < 10000
  const ldrPct = data.ldr != null ? Math.min(100, (data.ldr / 4095) * 100) : 0
  const batPct = data.bat != null ? (data.bat >= 4.2 ? 100 : data.bat <= 3.3 ? 0 : ((data.bat - 3.3) / 0.9) * 100) : 0

  const getLdrColor = (pct: number) => pct > 66 ? 'bg-emerald-500' : pct > 33 ? 'bg-amber-500' : 'bg-red-500'
  const getBatColor = (pct: number) => pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <motion.div 
      animate={flash ? { borderColor: 'rgba(16, 185, 129, 0.5)' } : { borderColor: 'rgba(39, 39, 42, 1)' }}
      className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition-colors duration-500"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-xs font-mono text-zinc-400">
            {POSITION_ICONS[id]}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">Node {id}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{POSITION_LABELS[id]}</div>
          </div>
        </div>
        <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} title={isOnline ? 'Online' : 'Offline'} />
      </div>

      {/* LDR Bar */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-zinc-400">LDR</span>
          <span className="text-zinc-300">{data.ldr ?? '—'} <span className="text-zinc-600">/ 4095</span></span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full ${getLdrColor(ldrPct)}`} style={{ width: `${ldrPct}%` }} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="flex flex-col rounded bg-zinc-950/50 p-1.5">
          <span className="text-zinc-500 text-[10px] uppercase mb-0.5 flex items-center gap-1"><Sun size={10}/> Lux</span>
          <span className="text-sky-400">{data.lux != null ? `${data.lux.toFixed(0)} lx` : '—'}</span>
        </div>
        <div className="flex flex-col rounded bg-zinc-950/50 p-1.5">
          <span className="text-zinc-500 text-[10px] uppercase mb-0.5 flex items-center gap-1"><Activity size={10}/> UV</span>
          <span className="text-zinc-300">{data.uv != null ? data.uv.toFixed(1) : '—'}</span>
        </div>
        <div className="col-span-2 flex justify-between items-center rounded bg-zinc-950/50 p-1.5">
          <span className="text-zinc-500 text-[10px] uppercase flex items-center gap-1"><Battery size={10}/> Battery</span>
          <div className="flex items-center gap-2">
            <span className="text-zinc-300">{data.bat != null ? `${data.bat.toFixed(2)}V` : '—'}</span>
            <div className="flex items-center opacity-80">
              <div className="h-2.5 w-5 rounded-[2px] border border-zinc-600 p-[1px]">
                <div className={`h-full ${getBatColor(batPct)}`} style={{ width: `${batPct}%` }} />
              </div>
              <div className="h-1 w-0.5 rounded-r-[1px] bg-zinc-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-right text-[9px] font-mono text-zinc-600">
        {data.lastSeen ? data.lastSeen.toLocaleTimeString() : 'Awaiting data...'}
      </div>
    </motion.div>
  )
}

export function LocalSensorNodes() {
  const { connected, nodes } = useLocalNodesMqtt()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
        <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          Local Sensor Nodes
        </span>
        <div className="flex items-center gap-2 text-xs font-mono">
          {connected ? (
             <span className="text-emerald-400 flex items-center gap-1"><Wifi size={12}/> Connected</span>
          ) : (
             <span className="text-zinc-500 flex items-center gap-1"><WifiOff size={12}/> Offline</span>
          )}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(id => (
          <NodeCard key={id} id={id} data={nodes[id]} />
        ))}
      </div>
    </div>
  )
}
