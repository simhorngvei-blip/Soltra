'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mqtt, { MqttClient } from 'mqtt'
import type { LiveTelemetry } from '@/lib/types'

interface UseSoltraMqttOptions {
  nodeId: string         // The node's mac_address or UUID used as topic segment
  topic?: string         // Override topic (defaults to helios/telemetry)
  enabled?: boolean      // Pause/resume connection
}

interface UseSoltraMqttReturn {
  telemetry: LiveTelemetry | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastUpdated: Date | null
  reconnect: () => void
  publish: (topic: string, payload: string) => void
}

// ⚠️  SECURITY: NEXT_PUBLIC_* env vars are visible in browser devtools and
// in the compiled JavaScript bundle delivered to every user's browser.
// These MQTT credentials WILL be exposed to anyone who opens devtools.
//
// This hook is intentionally kept for DEVELOPER / ADMIN views only.
// For homeowner-facing dashboards, use useTelemetryRealtime (Supabase Realtime)
// which is fully authenticated via the user's session token.
//
// The /api/command route already handles MQTT publishing server-side
// using the non-public HIVEMQ_* env vars, so command publishing is safe.
const HIVEMQ_HOST = process.env.NEXT_PUBLIC_HIVEMQ_HOST!
const HIVEMQ_PORT = process.env.NEXT_PUBLIC_HIVEMQ_PORT ?? '8884'
const HIVEMQ_USER = process.env.NEXT_PUBLIC_HIVEMQ_USER!
const HIVEMQ_PASS = process.env.NEXT_PUBLIC_HIVEMQ_PASS!

export function useSoltraMqtt({
  nodeId,
  topic,
  enabled = true,
}: UseSoltraMqttOptions): UseSoltraMqttReturn {
  const clientRef = useRef<MqttClient | null>(null)

  const [telemetry, setTelemetry]       = useState<LiveTelemetry | null>(null)
  const [isConnected, setIsConnected]   = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)

  const subscribeTopic = topic ?? `helios/telemetry`

  const connect = useCallback(() => {
    if (clientRef.current?.connected) return

    setIsConnecting(true)
    setError(null)

    const brokerUrl = `wss://${HIVEMQ_HOST}:${HIVEMQ_PORT}/mqtt`

    const client = mqtt.connect(brokerUrl, {
      username:        HIVEMQ_USER,
      password:        HIVEMQ_PASS,
      clientId:        `soltra-saas-${nodeId}-${Math.random().toString(16).slice(2, 8)}`,
      keepalive:       60,
      reconnectPeriod: 5000,
      connectTimeout:  10_000,
    })

    client.on('connect', () => {
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
      client.subscribe(subscribeTopic, { qos: 0 })
    })

    client.on('message', (incomingTopic, payload) => {
      if (incomingTopic !== subscribeTopic) return
      try {
        const data = JSON.parse(payload.toString()) as LiveTelemetry
        setTelemetry(data)
        setLastUpdated(new Date())
      } catch {
        console.warn('[useSoltraMqtt] Failed to parse MQTT payload', payload.toString())
      }
    })

    client.on('error', (err) => {
      setError(err.message)
      setIsConnecting(false)
    })

    client.on('close', () => {
      setIsConnected(false)
    })

    client.on('reconnect', () => {
      setIsConnecting(true)
    })

    clientRef.current = client
  }, [nodeId, subscribeTopic])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true)
      clientRef.current = null
    }
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(connect, 300)
  }, [connect, disconnect])

  const publish = useCallback((pubTopic: string, payload: string) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(pubTopic, payload, { qos: 0 })
    } else {
      console.warn('[useSoltraMqtt] Cannot publish — not connected')
    }
  }, [])

  useEffect(() => {
    if (!enabled) { disconnect(); return }
    connect()
    return () => { disconnect() }
  }, [enabled, connect, disconnect])

  return { telemetry, isConnected, isConnecting, error, lastUpdated, reconnect, publish }
}
