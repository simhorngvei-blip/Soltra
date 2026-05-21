'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adaptTelemetryRecord, type NormalizedTelemetry, type TelemetryRecord } from '@/lib/types'

interface UseTelemetryRealtimeResult {
  latest:      NormalizedTelemetry | null
  history:     NormalizedTelemetry[]       // Last 60 records, oldest-first (for charts)
  isConnected: boolean
  isLoading:   boolean
  error:       string | null
}

const HISTORY_SIZE = 60  // 5 minutes at 5s firmware interval

/**
 * Subscribes to live telemetry for a single node via Supabase Realtime.
 *
 * Architecture: Hardware → POST /api/telemetry/ingest → Supabase → Realtime WS → Browser
 * This replaces the direct browser MQTT connection, eliminating credential exposure.
 *
 * @param nodeId - The Supabase node UUID (from the nodes table)
 */
export function useTelemetryRealtime(nodeId: string | null): UseTelemetryRealtimeResult {
  const [latest, setLatest]           = useState<NormalizedTelemetry | null>(null)
  const [history, setHistory]         = useState<NormalizedTelemetry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Track if history has been bootstrapped from DB
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (!nodeId) {
      setIsLoading(false)
      return
    }

    bootstrapped.current = false
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // ── 1. Bootstrap: fetch recent history from DB ─────────────────────────
    const fetchHistory = async () => {
      const { data, error: fetchErr } = await supabase
        .from('telemetry')
        .select('*')
        .eq('node_id', nodeId)
        .order('recorded_at', { ascending: false })
        .limit(HISTORY_SIZE)

      if (fetchErr) {
        setError(fetchErr.message)
        setIsLoading(false)
        return
      }

      if (data && data.length > 0) {
        const records = (data as TelemetryRecord[])
          .reverse()           // oldest first for chart
          .map(adaptTelemetryRecord)

        setHistory(records)
        setLatest(records[records.length - 1])
      }

      bootstrapped.current = true
      setIsLoading(false)
    }

    fetchHistory()

    // ── 2. Subscribe to realtime inserts ───────────────────────────────────
    const channel = supabase
      .channel(`telemetry-node-${nodeId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'telemetry',
          filter: `node_id=eq.${nodeId}`,
        },
        (payload) => {
          const record = adaptTelemetryRecord(payload.new as TelemetryRecord)
          setLatest(record)
          setHistory((prev) => [...prev.slice(-(HISTORY_SIZE - 1)), record])
          setIsConnected(true)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true)
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false)
      })

    return () => {
      supabase.removeChannel(channel)
      setIsConnected(false)
    }
  }, [nodeId])

  return { latest, history, isConnected, isLoading, error }
}
