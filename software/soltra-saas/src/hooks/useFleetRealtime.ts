'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adaptTelemetryRecord, type NormalizedTelemetry, type TelemetryRecord } from '@/lib/types'

// Map of nodeId → most recent telemetry for that node
export type FleetNodeData = Record<string, NormalizedTelemetry>

interface UseFleetRealtimeResult {
  nodeData:    FleetNodeData
  isConnected: boolean
}

/**
 * Subscribes to live telemetry for ALL nodes owned by the current fleet admin.
 *
 * RLS policies automatically filter the Realtime stream to only rows
 * belonging to nodes in sites owned by the authenticated user.
 *
 * Compared to the old approach (one MQTT connection per table row), this uses
 * a single WebSocket connection for the entire fleet.
 *
 * @param nodeIds - Array of node UUIDs to track; pass [] to skip subscription
 */
export function useFleetRealtime(nodeIds: string[]): UseFleetRealtimeResult {
  const [nodeData, setNodeData]       = useState<FleetNodeData>({})
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (nodeIds.length === 0) return

    const supabase = createClient()

    // ── Bootstrap: fetch the latest record for each node ───────────────────
    const bootstrap = async () => {
      const { data } = await supabase
        .from('telemetry')
        .select('*')
        .in('node_id', nodeIds)
        .order('recorded_at', { ascending: false })

      if (data) {
        // Keep only the most recent record per node
        const latest: FleetNodeData = {}
        for (const record of data as TelemetryRecord[]) {
          if (!latest[record.node_id]) {
            latest[record.node_id] = adaptTelemetryRecord(record)
          }
        }
        setNodeData(latest)
      }
    }

    bootstrap()

    // ── Realtime: single channel for ALL fleet telemetry ──────────────────
    const channel = supabase
      .channel('fleet-telemetry-realtime')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'telemetry',
        },
        (payload) => {
          const record = payload.new as TelemetryRecord
          // Only update if this node is in our tracked set
          if (nodeIds.includes(record.node_id)) {
            setNodeData((prev) => ({
              ...prev,
              [record.node_id]: adaptTelemetryRecord(record),
            }))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true)
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [nodeIds.join(',')])   // re-subscribe only when node list changes

  return { nodeData, isConnected }
}
