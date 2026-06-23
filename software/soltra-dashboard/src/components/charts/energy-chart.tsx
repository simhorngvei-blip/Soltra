'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface EnergyBar {
  label: string
  kwh: number
}

interface EnergyProductionChartProps {
  data: EnergyBar[]
  height?: number
}

function EnergyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-xl">
      <p className="text-[10px] font-mono text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-amber-400">
        {payload[0].value?.toFixed(2)} <span className="text-zinc-500 font-normal">kWh</span>
      </p>
    </div>
  )
}

export function EnergyProductionChart({ data, height = 200 }: EnergyProductionChartProps) {
  const maxKwh = useMemo(() => Math.max(...data.map(d => d.kwh), 1), [data])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
            Energy Production
          </span>
        </div>
        <span className="text-lg font-bold text-amber-400 tabular-nums">
          {data.reduce((sum, d) => sum + d.kwh, 0).toFixed(1)}
          <span className="text-xs text-zinc-500 font-normal ml-1">kWh total</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#27272a' }}
          />
          <YAxis
            tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<EnergyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="kwh" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.kwh > maxKwh * 0.7 ? '#f59e0b' : '#78716c'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
