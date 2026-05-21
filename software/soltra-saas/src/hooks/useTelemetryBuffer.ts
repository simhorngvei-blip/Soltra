'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { LiveTelemetry } from '@/lib/types'

interface TelemetrySnapshot extends LiveTelemetry {
  timestamp: string
}

const MAX_BUFFER = 60 // 5 minutes of data at 5s intervals

/**
 * Accumulates live MQTT telemetry snapshots into a rolling buffer for charting.
 * Pass each new telemetry packet via `push()`.
 */
export function useTelemetryBuffer() {
  const [buffer, setBuffer] = useState<TelemetrySnapshot[]>([])

  const push = useCallback((telemetry: LiveTelemetry) => {
    const snapshot: TelemetrySnapshot = {
      ...telemetry,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }
    setBuffer(prev => [...prev.slice(-(MAX_BUFFER - 1)), snapshot])
  }, [])

  return { buffer, push }
}

interface EnergyBar {
  label: string
  kwh: number
}

/**
 * Generates mock "today's" hourly energy production data for the chart.
 * Deferred to useEffect to avoid SSR hydration mismatch from Date/Math.random.
 * Replace with real Supabase query in production.
 */
export function useMockEnergyData() {
  const [data, setData] = useState<EnergyBar[]>([])

  useEffect(() => {
    const hours: EnergyBar[] = []
    const currentHour = new Date().getHours()

    for (let h = 6; h <= Math.min(currentHour, 19); h++) {
      // Solar curve: peaks around noon
      const peakFactor = 1 - Math.abs(h - 12.5) / 7
      const kwh = Math.max(0, peakFactor * (0.8 + Math.random() * 0.4))
      hours.push({
        label: `${h.toString().padStart(2, '0')}:00`,
        kwh: parseFloat(kwh.toFixed(2)),
      })
    }
    setData(hours)
  }, []) // runs once on mount (client only)

  return data
}
