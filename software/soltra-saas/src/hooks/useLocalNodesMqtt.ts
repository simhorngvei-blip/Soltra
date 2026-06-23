import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'

const BROKER    = 'wss://5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud:8884/mqtt'
const TOPIC     = 'helios/telemetry'
const MQTT_USER = 'User_1'
const MQTT_PASS = 'hv8y5S9vFwLDJAP'

export interface LocalNodeData {
  ldr: number | null
  lux: number | null
  uv: number | null
  bat: number | null
  lastSeen: Date | null
}

const DEFAULT_NODES: Record<number, LocalNodeData> = {
  1: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  2: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  3: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  4: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
}

export function useLocalNodesMqtt() {
  const [connected, setConnected] = useState(false)
  const [nodes, setNodes] = useState(DEFAULT_NODES)
  const clientRef = useRef<mqtt.MqttClient | null>(null)

  useEffect(() => {
    const client = mqtt.connect(BROKER, {
      clientId: `soltra-saas-nodes-${Math.random().toString(16).slice(2, 10)}`,
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 3000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      client.subscribe(TOPIC)
    })
    
    client.on('disconnect', () => setConnected(false))
    client.on('error', () => setConnected(false))
    client.on('close', () => setConnected(false))

    client.on('message', (topic, payload) => {
      try {
        const d = JSON.parse(payload.toString())
        const now = new Date()

        if (Array.isArray(d.nodes)) {
          setNodes(prev => {
            const next = { ...prev }
            d.nodes.forEach((n: any) => {
              if (n.id >= 1 && n.id <= 4) {
                next[n.id] = { ldr: n.ldr, lux: n.lux, uv: n.uv, bat: n.bat, lastSeen: now }
              }
            })
            return next
          })
        }
      } catch (_) {}
    })

    return () => { client.end() }
  }, [])

  return { connected, nodes }
}
