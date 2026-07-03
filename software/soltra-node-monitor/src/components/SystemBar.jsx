import styles from './SystemBar.module.css'

const STATUS_STYLES = {
  tracking:           { color: '#22c55e', label: '● Tracking' },
  ldr_test_mode:      { color: '#eab308', label: '● LDR Test Mode' },
  manual_override:    { color: '#a855f7', label: '● Manual Override' },
  low_light_standby:  { color: '#64748b', label: '◌ Low Light Standby' },
  night_reset:        { color: '#64748b', label: '◌ Night Reset' },
  wind_stow:          { color: '#ef4444', label: '⚠ Wind Stow' },
  ai_stow:            { color: '#ef4444', label: '⚠ AI Stow' },
  sensor_offline:     { color: '#ef4444', label: '✕ Sensor Offline' },
  ephemeris_fb:       { color: '#38bdf8', label: '☀ Ephemeris Fallback' },
  ai_ephemeris:       { color: '#38bdf8', label: '☀ AI Ephemeris' },
}

function Stat({ label, value, unit }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value != null ? value : '—'}
        {value != null && unit ? <span className={styles.statUnit}> {unit}</span> : null}
      </span>
    </div>
  )
}

export default function SystemBar({ system, connected, lastUpdated }) {
  const statusStyle = system ? (STATUS_STYLES[system.status] ?? { color: '#94a3b8', label: system.status }) : null

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.connDot} style={{ background: connected ? '#22c55e' : '#ef4444' }} />
        <span className={styles.connLabel}>{connected ? 'Live' : 'Connecting...'}</span>
        {statusStyle && (
          <span className={styles.status} style={{ color: statusStyle.color }}>
            {statusStyle.label}
          </span>
        )}
      </div>

      <div className={styles.stats}>
        <Stat label="Irradiance" value={system?.irradiance?.toFixed(1)} unit="W/m²" />
        <Stat label="Pan"        value={system?.pan?.toFixed(1)}         unit="°" />
        <Stat label="Tilt"       value={system?.tilt?.toFixed(1)}        unit="°" />
        <Stat label="Power"      value={system?.power?.toFixed(1)}       unit="W" />
        <Stat label="Wind"       value={system?.wind?.toFixed(1)}        unit="m/s"
          style={system?.windAlert ? { color: '#ef4444' } : {}} />
      </div>

      <div className={styles.right}>
        {lastUpdated ? (
          <span className={styles.updated}>Updated {lastUpdated.toLocaleTimeString()}</span>
        ) : (
          <span className={styles.updated}>Waiting for data…</span>
        )}
      </div>
    </div>
  )
}
