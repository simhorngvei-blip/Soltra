import { useState } from 'react'
import styles from './CalibrationPanel.module.css'

export default function CalibrationPanel({ nodes }) {
  const [snapshot, setSnapshot] = useState(null)
  const [copied, setCopied]     = useState(false)

  const allOnline = [1,2,3,4].every(i => nodes[i]?.ldr != null)

  function capture() {
    setSnapshot({
      timestamp: new Date().toLocaleTimeString(),
      ldr: {
        1: nodes[1]?.ldr ?? 0,
        2: nodes[2]?.ldr ?? 0,
        3: nodes[3]?.ldr ?? 0,
        4: nodes[4]?.ldr ?? 0,
      },
      uv: {
        1: nodes[1]?.uv ?? 0,
        2: nodes[2]?.uv ?? 0,
        3: nodes[3]?.uv ?? 0,
        4: nodes[4]?.uv ?? 0,
      },
    })
    setCopied(false)
  }

  function calcOffsets() {
    if (!snapshot) return null
    const base = snapshot.ldr[1]
    return {
      2: Math.round(base - snapshot.ldr[2]),
      3: Math.round(base - snapshot.ldr[3]),
      4: Math.round(base - snapshot.ldr[4]),
    }
  }

  function calcUvOffsets() {
    if (!snapshot) return null
    const base = snapshot.uv[1]
    return {
      2: +(base - snapshot.uv[2]).toFixed(2),
      3: +(base - snapshot.uv[3]).toFixed(2),
      4: +(base - snapshot.uv[4]).toFixed(2),
    }
  }

  function generatePcbCode() {
    if (!snapshot) return ''
    const ldr = calcOffsets()
    const uv  = calcUvOffsets()
    const sign = v => v >= 0 ? `+${v}` : `${v}`

    return `// ── Regular Node Calibration ───────────────────────────
// Paste this into soltra_sensor_node.ino
// inside readAndTransmitData() (replace existing if block)

if      (NODE_ID == 1) { /* Baseline */ }
else if (NODE_ID == 2) { ldr_off = ${sign(ldr[2])}; uv_off = ${sign(uv[2])}f; }
else if (NODE_ID == 3) { ldr_off = ${sign(ldr[3])}; uv_off = ${sign(uv[3])}f; }`
  }

  function generateCamCode() {
    if (!snapshot) return ''
    const ldr = calcOffsets()
    const uv  = calcUvOffsets()
    const sign = v => v >= 0 ? `+${v}` : `${v}`

    return `// ── Camera Node Calibration ────────────────────────────
// Paste this into CameraWebServer.ino
// inside soltraSensorTask() right after readSensors(...)

int ldr_off = ${sign(ldr[4])};
float uv_off = ${sign(uv[4])}f;
ldr += ldr_off;
uv  += uv_off;`
  }

  function copyCode(type) {
    const code = type === 'pcb' ? generatePcbCode() : generateCamCode()
    navigator.clipboard.writeText(code).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2500)
    })
  }

  const offsets = calcOffsets()
  const uvOffsets = calcUvOffsets()

  return (
    <div className={styles.panel}>
      {/* Instructions */}
      <div className={styles.instructions}>
        <span className={styles.instrIcon}>📐</span>
        <div>
          <div className={styles.instrTitle}>How to calibrate</div>
          <div className={styles.instrText}>
            Place all 4 sensor nodes <strong>side by side</strong> pointing at the
            same light source. Once readings are stable, click <strong>Capture</strong>.
            Node 1 is used as the baseline — offsets are calculated for nodes 2, 3, and 4.
          </div>
        </div>
      </div>

      {/* Snapshot bar */}
      <div className={styles.captureRow}>
        <button
          className={`${styles.captureBtn} ${!allOnline ? styles.disabled : ''}`}
          onClick={capture}
          disabled={!allOnline}
          title={!allOnline ? 'Waiting for all 4 nodes to come online…' : ''}
        >
          {allOnline ? '📸 Capture Calibration Snapshot' : '⏳ Waiting for all nodes…'}
        </button>
        {snapshot && (
          <span className={styles.snapTime}>Captured at {snapshot.timestamp}</span>
        )}
      </div>

      {/* Results */}
      {snapshot && offsets && (
        <>
          {/* Offset table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Raw LDR</th>
                  <th>LDR Offset</th>
                  <th>Raw UV</th>
                  <th>UV Offset</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.baseline}>
                  <td><span className={styles.nodeBadge}>Node 1</span></td>
                  <td>{snapshot.ldr[1]}</td>
                  <td><span className={styles.tag}>Baseline</span></td>
                  <td>{snapshot.uv[1].toFixed(2)}</td>
                  <td><span className={styles.tag}>Baseline</span></td>
                </tr>
                {[2,3,4].map(i => (
                  <tr key={i}>
                    <td><span className={styles.nodeBadge}>Node {i}</span></td>
                    <td>{snapshot.ldr[i]}</td>
                    <td>
                      <span className={styles.offset} style={{
                        color: offsets[i] === 0 ? '#22c55e' : offsets[i] > 0 ? '#38bdf8' : '#f97316'
                      }}>
                        {offsets[i] >= 0 ? `+${offsets[i]}` : offsets[i]}
                      </span>
                    </td>
                    <td>{snapshot.uv[i].toFixed(2)}</td>
                    <td>
                      <span className={styles.offset} style={{
                        color: uvOffsets[i] === 0 ? '#22c55e' : '#38bdf8'
                      }}>
                        {uvOffsets[i] >= 0 ? `+${uvOffsets[i]}` : uvOffsets[i]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Generated code */}
          <div className={styles.codeWrap}>
            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeTitle}>📋 Paste into <code>soltra_sensor_node.ino</code></span>
                <button className={`${styles.copyBtn} ${copied === 'pcb' ? styles.copied : ''}`} onClick={() => copyCode('pcb')}>
                  {copied === 'pcb' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className={styles.code}>{generatePcbCode()}</pre>
            </div>

            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeTitle}>📋 Paste into <code>CameraWebServer.ino</code></span>
                <button className={`${styles.copyBtn} ${copied === 'cam' ? styles.copied : ''}`} onClick={() => copyCode('cam')}>
                  {copied === 'cam' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className={styles.code}>{generateCamCode()}</pre>
            </div>
          </div>

          <div className={styles.hint}>
            After updating the code, flash each sensor node with its own <code>NODE_ID</code>.
            The offset is applied automatically — no other changes needed.
          </div>
        </>
      )}
    </div>
  )
}
