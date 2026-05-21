'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { NormalizedTelemetry } from '@/lib/types'

// TelemetrySnapshot = NormalizedTelemetry (no extra fields needed)
export type TelemetrySnapshot = NormalizedTelemetry


interface TelemetryChartProps {
  data: TelemetrySnapshot[]
  metric: 'solar_yield' | 'wind_speed' | 'panel_angle'
  title: string
  unit: string
  color: string
  gradientId: string
  height?: number
  alertThreshold?: number
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-xl">
      <p className="text-[10px] font-mono text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-zinc-100">
        {payload[0].value?.toFixed(1)} <span className="text-zinc-500 font-normal">{unit}</span>
      </p>
    </div>
  )
}

// ─── Chart Component ─────────────────────────────────────────────────────────
export function TelemetryAreaChart({
  data, metric, title, unit, color, gradientId,
  height = 200, alertThreshold,
}: TelemetryChartProps) {
  const domain = useMemo(() => {
    if (data.length === 0) return [0, 100]
    const vals = data.map(d => d[metric] as number).filter(v => v != null)
    const min = Math.floor(Math.min(...vals) * 0.9)
    const max = Math.ceil(Math.max(...vals) * 1.1)
    return [min, max]
  }, [data, metric])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">{title}</span>
        </div>
        {data.length > 0 && (
          <span className="text-lg font-bold tabular-nums" style={{ color }}>
            {(data[data.length - 1][metric] as number)?.toFixed(1)}
            <span className="text-xs text-zinc-500 font-normal ml-1">{unit}</span>
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#27272a' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={domain}
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          {alertThreshold && (
            <ReferenceLine
              y={alertThreshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          )}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
