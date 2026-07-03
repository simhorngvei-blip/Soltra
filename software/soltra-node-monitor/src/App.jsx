import { useMqtt } from './hooks/useMqtt'
import NodeCard from './components/NodeCard'
import SystemBar from './components/SystemBar'
import CalibrationPanel from './components/CalibrationPanel'
import styles from './App.module.css'

export default function App() {
  const { connected, system, nodes, lastUpdated } = useMqtt()

  return (
    <div className={styles.app}>
      {/* Background grid */}
      <div className={styles.bgGrid} aria-hidden />

      <div className={styles.inner}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logoWrap}>
            <div className={styles.logoIcon}>☀</div>
            <div>
              <h1 className={styles.title}>Soltra Node Monitor</h1>
              <p className={styles.subtitle}>Live sensor node telemetry</p>
            </div>
          </div>
        </header>

        {/* System overview bar */}
        <SystemBar system={system} connected={connected} lastUpdated={lastUpdated} />

        {/* Node grid */}
        <section>
          <h2 className={styles.sectionTitle}>Sensor Nodes</h2>
          <div className={styles.nodeGrid}>
            {[1, 2, 3, 4].map(id => (
              <NodeCard key={id} id={id} data={nodes[id]} />
            ))}
          </div>
        </section>

        {/* LDR Compass Visualiser */}
        <section>
          <h2 className={styles.sectionTitle}>LDR Intensity Map</h2>
          <div className={styles.compass}>
            {/* Top */}
            <div className={styles.compassCell} style={{ gridArea: 'top' }}>
              <LdrCell label="Top (Node 1)" node={nodes[1]} />
            </div>
            {/* Left */}
            <div className={styles.compassCell} style={{ gridArea: 'left' }}>
              <LdrCell label="Left (Node 4)" node={nodes[4]} />
            </div>
            {/* Center marker */}
            <div className={styles.compassCenter} style={{ gridArea: 'center' }}>
              <span>⊙</span>
            </div>
            {/* Right */}
            <div className={styles.compassCell} style={{ gridArea: 'right' }}>
              <LdrCell label="Right (Node 2)" node={nodes[2]} />
            </div>
            {/* Bottom */}
            <div className={styles.compassCell} style={{ gridArea: 'bottom' }}>
              <LdrCell label="Bottom (Node 3)" node={nodes[3]} />
            </div>
          </div>
          <p className={styles.compassHint}>
            The tracker moves toward whichever side has the highest combined LDR reading.
            A difference of &gt;500 between opposing sides triggers a motor adjustment.
          </p>
        </section>

        {/* Calibration */}
        <section>
          <h2 className={styles.sectionTitle}>Sensor Calibration</h2>
          <CalibrationPanel nodes={nodes} />
        </section>
      </div>
    </div>
  )
}

function LdrCell({ label, node }) {
  const val = node?.ldr ?? 0
  const pct = Math.min(100, (val / 4095) * 100)
  const color = pct > 66 ? '#22c55e' : pct > 33 ? '#eab308' : '#ef4444'

  return (
    <div className={styles.ldrCell}>
      <div className={styles.ldrCellLabel}>{label}</div>
      <div className={styles.ldrCellVal} style={{ color }}>{val}</div>
      <div className={styles.ldrCellBarWrap}>
        <div className={styles.ldrCellBar} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
