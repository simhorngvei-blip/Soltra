'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, Radio } from 'lucide-react'

// ─── Fleet Bulk Command Panel ─────────────────────────────────────────────────
// Commands are sent server-side via POST /api/command so that MQTT credentials
// are never exposed in the browser. The fleet-wide topic broadcasts to ALL nodes.

const FLEET_TOPIC = 'helios/control/manual'

interface CommandLogEntry {
  cmd:       string
  label:     string
  timestamp: Date
  status:    'ok' | 'error'
}

const COMMANDS = [
  { label: '▲ All Retract H', cmd: '1', group: 'H', isStop: false },
  { label: '▼ All Extend H',  cmd: '2', group: 'H', isStop: false },
  { label: '■ Stop H',        cmd: '3', group: 'H', isStop: true  },
  { label: '◀ All Retract V', cmd: '4', group: 'V', isStop: false },
  { label: '▶ All Extend V',  cmd: '5', group: 'V', isStop: false },
  { label: '■ Stop V',        cmd: '6', group: 'V', isStop: true  },
]

export function FleetBulkCommandPanel() {
  const [isArmed, setIsArmed]   = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [log, setLog]           = useState<CommandLogEntry[]>([])

  const sendBulk = useCallback(async (cmd: string, label: string) => {
    if (!isArmed || isSending) return

    setIsSending(true)
    try {
      const res = await fetch('/api/command', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // Fleet bulk command — nodeId is 'fleet' to indicate broadcast.
        // The /api/command route handles fleet broadcasts via the wildcard topic.
        // TODO: Implement per-node fleet iteration in /api/command for granular control.
        body: JSON.stringify({ nodeId: 'fleet', topic: FLEET_TOPIC, payload: cmd }),
      })

      const status: 'ok' | 'error' = res.ok ? 'ok' : 'error'
      setLog((prev) => [{ cmd, label, timestamp: new Date(), status }, ...prev.slice(0, 29)])
    } catch {
      setLog((prev) => [{
        cmd, label, timestamp: new Date(), status: 'error',
      }, ...prev.slice(0, 29)])
    } finally {
      setIsSending(false)
    }
  }, [isArmed, isSending])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Bulk Command Interface</span>
          <span className="text-xs font-mono text-zinc-600">→ {FLEET_TOPIC}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${isArmed ? 'text-red-400 animate-pulse' : 'text-zinc-600'}`}>
            {isArmed ? '● ARMED' : '○ DISARMED'}
          </span>
          <button
            onClick={() => setIsArmed(!isArmed)}
            className={`
              flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all
              ${isArmed
                ? 'border-red-700 bg-red-950/50 text-red-400'
                : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }
            `}
          >
            {isArmed && <AlertTriangle size={12} />}
            {isArmed ? 'ARMED — LIVE' : 'ARM FLEET'}
          </button>
        </div>
      </div>

      <div className="p-4 flex gap-6">
        {/* Command buttons */}
        <div className="space-y-3">
          {(['H', 'V'] as const).map((group) => (
            <div key={group}>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                {group === 'H' ? 'Horizontal Axis' : 'Vertical Axis'}
              </div>
              <div className="flex gap-2">
                {COMMANDS.filter((c) => c.group === group).map(({ label, cmd, isStop }) => (
                  <button
                    key={cmd}
                    disabled={!isArmed || isSending}
                    onClick={() => sendBulk(cmd, label)}
                    className={`
                      rounded-lg border px-4 py-2.5 text-xs font-mono transition-all select-none
                      disabled:opacity-30 disabled:cursor-not-allowed
                      ${isStop
                        ? 'border-red-800/60 bg-red-950/40 text-red-400 hover:bg-red-900/50 active:bg-red-800/50 active:scale-95'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600 active:scale-95'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Dispatch Log */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Dispatch Log
          </div>
          <div className="h-32 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-2 font-mono text-xs space-y-0.5">
            {log.length === 0 ? (
              <span className="text-zinc-600">Arm fleet controls and issue a command.</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400">
                  <span className="text-zinc-600">{entry.timestamp.toLocaleTimeString()}</span>
                  <span className={entry.status === 'ok' ? 'text-emerald-400' : 'text-red-500'}>
                    BULK:{entry.cmd}
                  </span>
                  <span className="text-zinc-500">{entry.label}</span>
                  {entry.status === 'error' && (
                    <span className="text-red-600 text-[10px]">[ERR]</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
