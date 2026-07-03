import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'

const BROKER   = 'wss://5679a4b63e0c47a6bf63aeb14d328cdd.s1.eu.hivemq.cloud:8884/mqtt'
const TOPIC    = 'helios/telemetry'
const MQTT_USER = 'User_1'
const MQTT_PASS = 'hv8y5S9vFwLDJAP'

const DEFAULT_NODES = {
  1: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  2: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  3: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
  4: { ldr: null, lux: null, uv: null, bat: null, lastSeen: null },
}

export function useMqtt() {
  const [connected, setConnected]   = useState(false)
  const [system, setSystem]         = useState(null)
  const [nodes, setNodes]           = useState(DEFAULT_NODES)
  const [lastUpdated, setLastUpdated] = useState(null)
  const clientRef = useRef(null)

  useEffect(() => {
    // --- FAKE DATA INJECTION FOR SCREENSHOTS ---
    setConnected(true)
    const interval = setInterval(() => {
      // Force the timestamp to be 12:30 PM for the daytime screenshot
      const realNow = new Date()
      const now = new Date(
        realNow.getFullYear(),
        realNow.getMonth(),
        realNow.getDate(),
        12, // 12 PM
        30, // 30 minutes
        realNow.getSeconds() // Keep seconds moving so it looks live
      )

      const hour = now.getHours() + (now.getMinutes() / 60)
      
      // Calculate realistic solar values based on a Gaussian curve peaking at 12:30 (12.5)
      // If it's night (before 6am or after 7pm), values drop to zero
      const isDaytime = hour >= 6.0 && hour <= 19.0
      
      // Peak factor from 0.0 to 1.0 depending on time of day
      let sunFactor = 0
      if (isDaytime) {
        // Simple bell curve peaking at noon
        const distFromNoon = Math.abs(hour - 12.5)
        sunFactor = Math.max(0, 1 - (distFromNoon / 6.5))
      }

      // Add a tiny bit of random noise
      const noise = () => (Math.random() * 0.1) - 0.05
      const currentFactor = Math.max(0, sunFactor + noise())

      const status = isDaytime ? 'tracking' : 'low_light_standby'
      const irradiance = isDaytime ? Math.floor(currentFactor * 1050) : 0
      const power = isDaytime ? currentFactor * 250 : 0
      const uv = isDaytime ? currentFactor * 11 : 0
      const lux = isDaytime ? Math.floor(currentFactor * 100000) : Math.floor(Math.random() * 5)
      
      // LDR usually reads low in dark, high in light. 
      // Using a 12-bit ADC (0-4095), daytime bright sun should read around 3000-3500.
      const ldrBase = isDaytime ? 3000 + (currentFactor * 500) : 10 + Math.random() * 5

      setSystem({
        status:      status,
        irradiance:  irradiance,
        pan:         isDaytime ? 90 + ((hour - 12.5) * 15) : 90, // Track across the sky
        tilt:        isDaytime ? 45 - (currentFactor * 30) : 45, // Tilt up near noon, lay flat at night
        power:       power,
        wind:        Math.random() * 2 + 0.5,
        windAlert:   false,
      })
      setNodes({
        1: { ldr: Math.floor(ldrBase + Math.random()*20), lux: lux, uv: uv, bat: 98, lastSeen: now },
        2: { ldr: Math.floor(ldrBase + Math.random()*20), lux: lux, uv: uv, bat: 97, lastSeen: now },
        3: { ldr: Math.floor(ldrBase + Math.random()*20), lux: lux, uv: uv, bat: 99, lastSeen: now },
        4: { ldr: Math.floor(ldrBase + Math.random()*20), lux: lux, uv: uv, bat: 96, lastSeen: now },
      })
      setLastUpdated(now)
    }, 1500)
    return () => clearInterval(interval)
    // ------------------------------------------

    const client = mqtt.connect(BROKER, {
      clientId: `soltra-monitor-${Math.random().toString(16).slice(2, 10)}`,
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

        setSystem({
          status:      d.status,
          irradiance:  d.irradiance_wm2,
          pan:         d.pan_angle_deg,
          tilt:        d.tilt_angle_deg,
          power:       d.power_watts,
          wind:        d.wind_speed_ms,
          windAlert:   d.wind_alert,
        })

        if (Array.isArray(d.nodes)) {
          setNodes(prev => {
            const next = { ...prev }
            d.nodes.forEach(n => {
              if (n.id >= 1 && n.id <= 4) {
                next[n.id] = { ldr: n.ldr, lux: n.lux, uv: n.uv, bat: n.bat, lastSeen: now }
              }
            })
            return next
          })
        }
        setLastUpdated(now)
      } catch (_) {}
    })

    return () => { client.end() }
  }, [])

  return { connected, system, nodes, lastUpdated }
}
