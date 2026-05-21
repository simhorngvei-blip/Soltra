'use client'

import { useState, useCallback, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Square, AlertTriangle } from 'lucide-react'


// ─── Command Protocol (matches Heltec firmware mqttCb) ───────────────────────
// 1 = Retract Horizontal    4 = Retract Vertical
// 2 = Extend Horizontal     5 = Extend Vertical
// 3 = Stop Horizontal       6 = Stop Vertical

const CONTROL_TOPIC = 'helios/control/manual'

interface CommandLogEntry {
  cmd: number
  label: string
  timestamp: Date
}

interface ManualControlPanelProps {
  publish: (topic: string, payload: string) => void
  isConnected: boolean
}

// ─── Momentary Button ─────────────────────────────────────────────────────────
function MotorButton({
  icon: Icon,
  label,
  cmd,
  onCommand,
  disabled,
  variant = 'default',
}: {
  icon: LucideIcon
  label: string
  cmd: number
  onCommand: (cmd: number, label: string) => void
  disabled: boolean
  variant?: 'default' | 'stop'
}) {
  const [isPressed, setIsPressed] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Momentary press: sends command on mouseDown, stops on mouseUp
  const handlePress = useCallback(() => {
    if (disabled) return
    setIsPressed(true)
    onCommand(cmd, label)
    // Repeat command every 200ms while held
    intervalRef.current = setInterval(() => onCommand(cmd, label), 200)
  }, [cmd, label, onCommand, disabled])

  const handleRelease = useCallback(() => {
    setIsPressed(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const base = variant === 'stop'
    ? 'border-red-800/60 bg-red-950/40 text-red-400 hover:bg-red-900/50 active:bg-red-800/50'
    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600'

  return (
    <button
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      disabled={disabled}
      className={`
        rounded-xl border p-3 transition-all select-none
        disabled:opacity-30 disabled:cursor-not-allowed
        ${base}
        ${isPressed ? 'scale-95 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20' : ''}
      `}
      title={label}
    >
      <Icon size={20} strokeWidth={2.5} />
    </button>
  )
}

// ─── Main Control Panel ──────────────────────────────────────────────────────
export function ManualControlPanel({ publish, isConnected }: ManualControlPanelProps) {
  const [log, setLog] = useState<CommandLogEntry[]>([])
  const [isArmed, setIsArmed] = useState(false)

  const sendCommand = useCallback((cmd: number, label: string) => {
    publish(CONTROL_TOPIC, String(cmd))
    setLog(prev => [{ cmd, label, timestamp: new Date() }, ...prev.slice(0, 19)])
  }, [publish])

  const disabled = !isConnected || !isArmed

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">Manual Override</span>
          <span className="text-[10px] font-mono text-zinc-600">→ helios/control/manual</span>
        </div>

        {/* Arm switch */}
        <button
          onClick={() => setIsArmed(!isArmed)}
          className={`
            flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all
            ${isArmed
              ? 'border-amber-700 bg-amber-950/50 text-amber-400'
              : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }
          `}
        >
          {isArmed && <AlertTriangle size={12} />}
          {isArmed ? 'ARMED' : 'ARM CONTROLS'}
        </button>
      </div>

      <div className="p-4 flex gap-6">
        {/* D-Pad area */}
        <div className="flex flex-col items-center gap-2">
          {/* Labels */}
          <div className="flex gap-12 mb-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Horizontal</span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Vertical</span>
          </div>

          <div className="flex gap-6">
            {/* Horizontal Axis (Actuator 1) */}
            <div className="flex flex-col items-center gap-2">
              <MotorButton icon={ChevronUp}   label="Retract H" cmd={1} onCommand={sendCommand} disabled={disabled} />
              <MotorButton icon={Square}       label="Stop H"    cmd={3} onCommand={sendCommand} disabled={disabled} variant="stop" />
              <MotorButton icon={ChevronDown}  label="Extend H"  cmd={2} onCommand={sendCommand} disabled={disabled} />
            </div>

            {/* Divider */}
            <div className="w-px bg-zinc-800 self-stretch" />

            {/* Vertical Axis (Actuator 2) */}
            <div className="flex flex-col items-center gap-2">
              <MotorButton icon={ChevronLeft}  label="Retract V" cmd={4} onCommand={sendCommand} disabled={disabled} />
              <MotorButton icon={Square}        label="Stop V"    cmd={6} onCommand={sendCommand} disabled={disabled} variant="stop" />
              <MotorButton icon={ChevronRight} label="Extend V"  cmd={5} onCommand={sendCommand} disabled={disabled} />
            </div>
          </div>

          {/* Safety notice */}
          {!isArmed && (
            <p className="text-[10px] text-zinc-600 mt-2 font-mono text-center max-w-[220px]">
              ARM the controls to enable manual motor commands
            </p>
          )}
        </div>

        {/* Command Log */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Command Log
          </div>
          <div className="h-40 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-2 font-mono text-xs space-y-0.5">
            {log.length === 0 ? (
              <span className="text-zinc-600">No commands sent yet.</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400">
                  <span className="text-zinc-600">{entry.timestamp.toLocaleTimeString()}</span>
                  <span className="text-emerald-400">CMD:{entry.cmd}</span>
                  <span className="text-zinc-500">{entry.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
