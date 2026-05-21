import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ITEMS = [
  { id: "i", badge: "I", title: "MOTOR ACTUATORS", subtitle: "Linear Drive Systems", rank: 2 },
  { id: "ii", badge: "II", title: "SOLAR PANELS", subtitle: "Photovoltaic Arrays", rank: 4 },
  { id: "iii", badge: "III", title: "SENSOR ARRAY", subtitle: "Environmental Data", rank: 3 },
  { id: "iv", badge: "IV", title: "SYSTEM CORE", subtitle: "ESP32 MQTT Hub", rank: 1 },
];

function useHardwareTelemetry() {
  const [telemetry, setTelemetry] = useState({
    motors: [
      { index: "01", title: "Actuator Alpha", status: "OK", current: 1.2 },
      { index: "02", title: "Actuator Beta", status: "OK", current: 1.4 },
      { index: "03", title: "Limit Switch X", status: "CLEAR", current: 0 },
      { index: "04", title: "Limit Switch Y", status: "CLEAR", current: 0 }
    ],
    panels: [
      { index: "01", title: "Panel Array 1", status: "OPTIMAL", power: 450 },
      { index: "02", title: "Panel Array 2", status: "OPTIMAL", power: 420 }
    ],
    sensors: [
      { index: "01", title: "Anemometer", status: "OK", value: "2.1 m/s" },
      { index: "02", title: "Pyranometer", status: "OK", value: "850 W/m²" },
      { index: "03", title: "IMU Gyro", status: "OK", value: "Pitch 45°" }
    ],
    core: [
      { index: "01", title: "MQTT Broker", status: "CONNECTED", ping: "14ms" },
      { index: "02", title: "Memory Heap", status: "OK", free: "128KB" },
      { index: "03", title: "WiFi Signal", status: "STRONG", rssi: "-55dBm" }
    ]
  });

  useEffect(() => {
    const int = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        sensors: [
          { ...prev.sensors[0], value: Math.max(0, parseFloat(prev.sensors[0].value) + (Math.random() - 0.5) * 0.5).toFixed(1) + " m/s" },
          { ...prev.sensors[1], value: Math.max(0, parseInt(prev.sensors[1].value) + (Math.random() - 0.5) * 50).toFixed(0) + " W/m²" },
          prev.sensors[2]
        ],
        panels: [
          { ...prev.panels[0], power: Math.max(0, prev.panels[0].power + (Math.random() - 0.5) * 10) },
          { ...prev.panels[1], power: Math.max(0, prev.panels[1].power + (Math.random() - 0.5) * 10) }
        ],
        motors: prev.motors.map(m => m.title.includes("Actuator") ? { ...m, current: Math.max(0.5, m.current + (Math.random() - 0.5) * 0.2) } : m),
        core: prev.core.map(c => c.title.includes("Ping") ? { ...c, ping: Math.floor(10 + Math.random() * 10) + "ms" } : c)
      }));
    }, 2000);
    return () => clearInterval(int);
  }, []);

  return telemetry;
}

export default function ResumePage({ src }) {
  const navigate = useNavigate();
  const telemetry = useHardwareTelemetry();
  const [active, setActive] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
      if (e.key === "ArrowDown") setActive((i) => Math.min(ITEMS.length - 1, i + 1));
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "Escape" || e.key === "Backspace") navigate(-1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div id="menu-screen">
      <video src={src} autoPlay loop muted playsInline />
      <div className="resume-entry-mask" aria-hidden="true">
        <video className="resume-entry-video" src={src} autoPlay loop muted playsInline />
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&display=swap');

        .resume-entry-mask {
          position: absolute;
          inset: 0;
          z-index: 9;
          overflow: hidden;
          background: #0047FF;
          clip-path: circle(0 at 50% 50%);
          animation: resume-entry-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: none;
        }

        .resume-entry-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        @keyframes resume-entry-reveal {
          from { clip-path: circle(0 at 50% 50%); }
          to { clip-path: circle(150vmax at 50% 50%); }
        }

        .resume-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
        }

        .resume-stack {
          position: absolute;
          top: 9vh;
          left: 2.8vw;
          width: min(47vw, 720px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          transform: scale(0.9);
          transform-origin: top left;
        }

        .resume-list-tag {
          font-family: 'Anton', sans-serif;
          font-size: 92px;
          line-height: 0.9;
          color: #f6fbff;
          letter-spacing: 2px;
          margin: 0 0 6px 12px;
          text-shadow: 0 2px 0 rgba(0,0,0,0.18);
          opacity: 0;
          transform: translateX(-24px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .resume-list-tag.mounted {
          opacity: 1;
          transform: translateX(0);
        }

        .resume-card-wrap {
          position: relative;
          opacity: 0;
          transform: translateX(-48px);
          transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: all;
          cursor: pointer;
        }
        .resume-card-wrap.mounted {
          opacity: 1;
          transform: translateX(0);
        }

        .resume-card {
          position: relative;
          height: 112px;
          background: rgba(0, 20, 30, 0.9);
          clip-path: polygon(0 0, 97% 0, 100% 100%, 3% 100%);
          box-shadow: 0 8px 0 rgba(0, 0, 0, 0.85);
          transition: transform 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
          overflow: visible;
          border: 1px solid rgba(0, 217, 255, 0.3);
        }
        .resume-card-wrap.active .resume-card {
          background: rgba(0, 217, 255, 0.1);
          box-shadow: 10px 8px 0 #ff2a2a;
          transform: translateX(6px);
          border: 1px solid #00d9ff;
        }

        .resume-card-inner {
          position: absolute;
          inset: 0;
          padding: 14px 22px 14px 62px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .resume-badge {
          position: absolute;
          top: 10px;
          left: -10px;
          width: 56px;
          height: 70px;
          background: #000;
          border: 3px solid #ff2a2a;
          clip-path: polygon(14% 0, 100% 0, 84% 100%, 0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-8deg);
          box-shadow: 0 4px 0 rgba(0,0,0,0.28);
          transition: background 0.22s ease, border-color 0.22s ease;
        }
        .resume-badge-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          color: #fff;
          letter-spacing: 1px;
          transform: rotate(8deg);
        }
        .resume-card-wrap.active .resume-badge {
          background: #ff2a2a;
          border-color: #00d9ff;
        }
        .resume-card-wrap.active .resume-badge-text {
          color: #000;
        }

        .resume-title {
          font-family: 'Anton', sans-serif;
          font-size: 56px;
          line-height: 0.9;
          letter-spacing: 1px;
          color: #00d9ff;
          transition: color 0.22s ease;
        }
        .resume-card-wrap.active .resume-title {
          color: #fff;
        }

        .resume-rank {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .resume-rank-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          letter-spacing: 2px;
          color: #ff2a2a;
          transition: color 0.22s ease;
        }
        .resume-rank-number {
          font-family: 'Anton', sans-serif;
          font-size: 70px;
          line-height: 0.82;
          color: #ff2a2a;
          transition: color 0.22s ease;
        }
        .resume-card-wrap.active .resume-rank-label,
        .resume-card-wrap.active .resume-rank-number {
          color: #00d9ff;
        }

        .resume-subtitle-bar {
          position: absolute;
          left: 64px;
          right: 14px;
          bottom: 12px;
          height: 34px;
          background: #00d9ff;
          clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
          display: flex;
          align-items: center;
          padding: 0 18px;
          transition: background 0.22s ease;
        }
        .resume-card-wrap.active .resume-subtitle-bar {
          background: #ff2a2a;
        }

        .resume-subtitle {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          line-height: 1;
          letter-spacing: 1px;
          color: #000;
          transition: color 0.22s ease;
        }
        .resume-card-wrap.active .resume-subtitle {
          color: #fff;
        }

        .resume-detail-panel {
          position: absolute;
          top: 9.5vh;
          right: 4.5vw;
          width: min(39vw, 620px);
          min-height: 74vh;
          z-index: 12;
          padding: 22px 24px 24px 24px;
          background: rgba(0, 10, 20, 0.9);
          border: 1px solid rgba(0, 217, 255, 0.3);
          border-left: 4px solid #ff2a2a;
          clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
          box-shadow: 16px 16px 0 rgba(0, 0, 0, 0.55);
          overflow: hidden;
          backdrop-filter: blur(8px);
        }
        .resume-detail-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(0, 217, 255, 0.08) 0 15%, transparent 15% 100%);
          pointer-events: none;
        }
        .resume-detail-top {
          position: relative;
          display: grid;
          grid-template-columns: 70px 1fr auto;
          align-items: center;
          gap: 14px;
          min-height: 92px;
          padding: 0 18px;
          background: rgba(0, 217, 255, 0.1);
          border-bottom: 2px solid #00d9ff;
          clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
          color: #fff;
        }
        .resume-detail-top-index {
          font-family: 'Anton', sans-serif;
          font-size: 46px;
          line-height: 1;
          color: #00d9ff;
        }
        .resume-detail-top-title {
          font-family: 'Anton', sans-serif;
          font-size: 42px;
          line-height: 0.92;
          letter-spacing: 1px;
        }
        .resume-detail-top-progress {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 42px;
          letter-spacing: 2px;
          line-height: 1;
          color: #ff2a2a;
        }
        .resume-detail-list {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 18px;
        }
        .resume-detail-row {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          align-items: center;
          gap: 14px;
          min-height: 56px;
          padding: 0 14px;
          background: rgba(0, 20, 30, 0.8);
          clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
          border-left: 2px solid #ff2a2a;
          transition: transform 0.16s ease, background 0.16s ease;
        }
        .resume-detail-row:hover {
          transform: translateX(4px);
          background: rgba(0, 217, 255, 0.15);
        }
        .resume-detail-row-index {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 26px;
          letter-spacing: 1px;
          color: #00d9ff;
        }
        .resume-detail-row-title {
          font-family: 'Anton', sans-serif;
          font-size: 28px;
          line-height: 1;
          color: #fff;
        }
        .resume-detail-status {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 1.1px;
          color: #000;
          background: #00d9ff;
          padding: 7px 12px;
          clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
        }
        .resume-detail-bottom {
          position: relative;
          margin-top: 22px;
          padding: 18px;
          background: rgba(0, 10, 20, 0.9);
          border: 1px solid rgba(0, 217, 255, 0.2);
          clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
        }
        .resume-detail-bottom-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 30px;
          letter-spacing: 2px;
          color: #ff2a2a;
          margin-bottom: 14px;
        }
        .resume-detail-bullets {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .resume-detail-bullet {
          font-family: 'monospace', sans-serif;
          font-size: 14px;
          line-height: 1.4;
          color: #00d9ff;
        }

        .resume-mobile-controls {
          display: none;
        }

        .resume-mobile-btn {
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(6, 13, 55, 0.8);
          color: #fff;
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 1.2px;
          font-size: 13px;
          padding: 7px 12px;
          border-radius: 8px;
          min-width: 84px;
        }

        @media (max-width: 768px) {
          .resume-mobile-controls {
            position: fixed;
            left: 8px;
            right: 8px;
            bottom: max(8px, env(safe-area-inset-bottom));
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            pointer-events: all;
          }
        }

      `}</style>

      <div className="resume-overlay">
        <div className="resume-stack">
          <div className={`resume-list-tag${mounted ? " mounted" : ""}`}>LOGS</div>
          {ITEMS.map((item, index) => (
            <div
              key={item.id}
              className={`resume-card-wrap${active === index ? " active" : ""}${mounted ? " mounted" : ""}`}
              style={{ transitionDelay: `${index * 55}ms` }}
              onMouseEnter={() => {
                setActive(index);
              }}
              onClick={() => {
                setActive(index);
              }}
            >
              <div className="resume-card">
                <div className="resume-badge">
                  <div className="resume-badge-text">{item.badge}</div>
                </div>
                <div className="resume-card-inner">
                  <div className="resume-title">{item.title}</div>
                  <div className="resume-rank">
                    <div className="resume-rank-label">RANK</div>
                    <div className="resume-rank-number">{item.rank}</div>
                  </div>
                </div>
                <div className="resume-subtitle-bar">
                  <div className="resume-subtitle">{item.subtitle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {active === 0 && (
          <div className="resume-detail-panel">
            <div className="resume-detail-top">
              <div className="resume-detail-top-index">01</div>
              <div className="resume-detail-top-title">MOTOR ACTUATORS</div>
              <div className="resume-detail-top-progress">SYS</div>
            </div>
            <div className="resume-detail-list">
              {telemetry.motors.map((row) => (
                <div className="resume-detail-row" key={row.index}>
                  <div className="resume-detail-row-index">{row.index}</div>
                  <div className="resume-detail-row-title">{row.title}</div>
                  <div className="resume-detail-status" style={{ background: row.status === 'OK' || row.status === 'CLEAR' ? '#00d9ff' : '#ff2a2a', color: row.status === 'OK' || row.status === 'CLEAR' ? '#000' : '#fff' }}>{row.status}</div>
                </div>
              ))}
            </div>
            <div className="resume-detail-bottom">
              <div className="resume-detail-bottom-title">DIAGNOSTICS</div>
              <div className="resume-detail-bullets">
                {telemetry.motors.map(m => (
                  <div key={m.title} className="resume-detail-bullet" style={{color: m.status !== 'OK' && m.status !== 'CLEAR' ? '#ff2a2a' : '#00d9ff'}}>
                    {'>'} {m.title}: {m.title.includes("Actuator") ? `Current draw ${m.current.toFixed(2)}A.` : `State: ${m.status}.`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {active === 1 && (
          <div className="resume-detail-panel">
            <div className="resume-detail-top">
              <div className="resume-detail-top-index">02</div>
              <div className="resume-detail-top-title">SOLAR PANELS</div>
              <div className="resume-detail-top-progress">PWR</div>
            </div>
            <div className="resume-detail-list">
              {telemetry.panels.map((row) => (
                <div className="resume-detail-row" key={row.index}>
                  <div className="resume-detail-row-index">{row.index}</div>
                  <div className="resume-detail-row-title">{row.title}</div>
                  <div className="resume-detail-status" style={{ background: '#00d9ff', color: '#000' }}>{row.status}</div>
                </div>
              ))}
            </div>
            <div className="resume-detail-bottom">
              <div className="resume-detail-bottom-title">DIAGNOSTICS</div>
              <div className="resume-detail-bullets">
                {telemetry.panels.map(p => (
                  <div key={p.title} className="resume-detail-bullet">
                    {'>'} {p.title}: Generating {p.power.toFixed(0)}W.
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {active === 2 && (
          <div className="resume-detail-panel">
            <div className="resume-detail-top">
              <div className="resume-detail-top-index">03</div>
              <div className="resume-detail-top-title">SENSOR ARRAY</div>
              <div className="resume-detail-top-progress">ENV</div>
            </div>
            <div className="resume-detail-list">
              {telemetry.sensors.map((row) => (
                <div className="resume-detail-row" key={row.index}>
                  <div className="resume-detail-row-index">{row.index}</div>
                  <div className="resume-detail-row-title">{row.title}</div>
                  <div className="resume-detail-status" style={{ background: '#00d9ff', color: '#000' }}>{row.status}</div>
                </div>
              ))}
            </div>
            <div className="resume-detail-bottom">
              <div className="resume-detail-bottom-title">DIAGNOSTICS</div>
              <div className="resume-detail-bullets">
                {telemetry.sensors.map(s => (
                  <div key={s.title} className="resume-detail-bullet">
                    {'>'} {s.title}: Reading {s.value}.
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {active === 3 && (
          <div className="resume-detail-panel">
            <div className="resume-detail-top">
              <div className="resume-detail-top-index">04</div>
              <div className="resume-detail-top-title">SYSTEM CORE</div>
              <div className="resume-detail-top-progress">SYS</div>
            </div>
            <div className="resume-detail-list">
              {telemetry.core.map((row) => (
                <div className="resume-detail-row" key={row.index}>
                  <div className="resume-detail-row-index">{row.index}</div>
                  <div className="resume-detail-row-title">{row.title}</div>
                  <div className="resume-detail-status" style={{ background: '#00d9ff', color: '#000' }}>{row.status}</div>
                </div>
              ))}
            </div>
            <div className="resume-detail-bottom">
              <div className="resume-detail-bottom-title">DIAGNOSTICS</div>
              <div className="resume-detail-bullets">
                {telemetry.core.map(c => (
                  <div key={c.title} className="resume-detail-bullet">
                    {'>'} {c.title}: {c.ping ? `Latency ${c.ping}` : c.free ? `Available ${c.free}` : `RSSI ${c.rssi}`}.
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="resume-mobile-controls" aria-label="Resume mobile controls">
        <button className="resume-mobile-btn" type="button" onClick={() => navigate(-1)}>
          BACK
        </button>
      </div>
    </div>
  );
}