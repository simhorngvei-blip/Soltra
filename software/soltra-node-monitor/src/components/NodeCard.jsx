import { useState, useEffect } from 'react'
import styles from './NodeCard.module.css'

const POSITION_LABELS = { 1: 'Top', 2: 'Right', 3: 'Bottom', 4: 'Left' }
const POSITION_ICONS  = { 1: '↑', 2: '→', 3: '↓', 4: '←' }

function LdrBar({ value }) {
  const pct = value != null ? Math.min(100, (value / 4095) * 100) : 0
  const color = pct > 66 ? '#22c55e' : pct > 33 ? '#eab308' : '#ef4444'
  return (
    <div className={styles.ldrBarWrap}>
      <div className={styles.ldrBar} style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function Metric({ label, value, unit, highlight }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={highlight ? { color: '#38bdf8' } : {}}>
        {value != null ? `${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}` : '—'}
        {value != null && unit ? <span className={styles.metricUnit}> {unit}</span> : null}
      </span>
    </div>
  )
}

function BatteryIcon({ voltage }) {
  if (voltage == null) return null
  const pct = voltage >= 4.2 ? 100 : voltage <= 3.3 ? 0 : ((voltage - 3.3) / 0.9) * 100
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444'
  return (
    <div className={styles.battIcon}>
      <div className={styles.battBody}>
        <div className={styles.battFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={styles.battNub} />
    </div>
  )
}

export default function NodeCard({ id, data }) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (data.lastSeen) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [data.lastSeen])

  const isOnline = data.lastSeen && (Date.now() - data.lastSeen.getTime()) < 10000
  const lastSeenStr = data.lastSeen
    ? data.lastSeen.toLocaleTimeString()
    : 'No data'

  return (
    <div className={`${styles.card} ${flash ? styles.flash : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.nodeId}>
          <span className={styles.icon}>{POSITION_ICONS[id]}</span>
          <div>
            <div className={styles.nodeName}>Node {id}</div>
            <div className={styles.nodePos}>{POSITION_LABELS[id]}</div>
          </div>
        </div>
        <div className={styles.statusDot} style={{ background: isOnline ? '#22c55e' : '#475569' }}
          title={isOnline ? 'Online' : 'Offline'} />
      </div>

      {/* LDR Bar */}
      <div className={styles.section}>
        <div className={styles.ldrRow}>
          <span className={styles.metricLabel}>LDR</span>
          <span className={styles.ldrValue}>{data.ldr ?? '—'} <span className={styles.metricUnit}>/ 4095</span></span>
        </div>
        <LdrBar value={data.ldr} />
      </div>

      {/* Metrics */}
      <div className={styles.metrics}>
        <Metric label="Lux"      value={data.lux} unit="lx" highlight />
        <Metric label="UV Index" value={data.uv != null ? +data.uv.toFixed(1) : null} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Battery</span>
          <div className={styles.batRow}>
            <BatteryIcon voltage={data.bat} />
            <span className={styles.metricValue}>
              {data.bat != null ? `${data.bat.toFixed(2)} V` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>{lastSeenStr}</div>
    </div>
  )
}
