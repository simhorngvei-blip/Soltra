import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import VoiceCloningModule from "./components/VoiceCloningModule";

const ITEMS = [
  { id: "hub",     label: "SYSTEM HUB",    page: "hub",     fontSize: 80, offsetX: 0,  offsetY: 0,  skew: -6,  skewY: 10  },
  { id: "logs",    label: "HARDWARE LOGS", page: "logs",    fontSize: 66, offsetX: 20, offsetY: 70, skew: -11, skewY: -10 },
  { id: "network", label: "NETWORK GRID",  page: "network", fontSize: 74, offsetX: 16, offsetY: 80, skew: -3,  skewY: 5   },
];

const CLIP_SHAPES = [
  (w, h) => `polygon(0px 0px, ${w}px 0px, ${w - 40}px ${h}px, 0px ${h}px)`,
  (w, h) => `polygon(0px 0px, ${w}px 0px, ${w - 40}px ${h}px, 0px ${h}px)`,
  (w, h) => `polygon(0px 0px, ${w}px 0px, ${w - 40}px ${h}px, 0px ${h}px)`,
  (w, h) => `polygon(0px 0px, ${w}px 0px, ${w - 40}px ${h}px, 0px ${h}px)`,
  (w, h) => `polygon(0px 0px, ${w}px 0px, ${w - 40}px ${h}px, 0px ${h}px)`,
];

export default function P3Menu({ onNavigate }) {
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [time, setTime] = useState(new Date());
  const [showVoiceCloning, setShowVoiceCloning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activate = (idx) => {
    setActive(idx);
    setAnimKey(k => k + 1);
  };

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp")   activate(Math.max(0, active - 1));
      if (e.key === "ArrowDown") activate(Math.min(ITEMS.length - 1, active + 1));
      if (e.key === "Enter")     onNavigate?.(ITEMS[active].page);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <>
      <style>{`
        .p3-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .p3-stripe  { position:absolute; right:0; top:0; bottom:0; width:5px; background:#00d9ff; z-index:10; pointer-events:none; }
        .p3-stripe2 { position:absolute; right:9px; top:0; bottom:0; width:2px; background:rgba(0, 217, 255, 0.22); z-index:10; pointer-events:none; }

        .p3-menu {
          position: relative;
          z-index: 20;
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: all;
        }

        .p3-row {
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          text-decoration: none;
          opacity: 0;
          transform: translateX(36px);
          transition: opacity 0.38s ease, transform 0.38s cubic-bezier(0.22,1,0.36,1);
        }
        .p3-row.mounted {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }

        .p3-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 120%; height: 200%;
          background: radial-gradient(ellipse at center, rgba(255,100,180,0.35) 0%, transparent 70%);
          filter: blur(18px);
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .p3-row.active .p3-glow { opacity: 1; }

        .p3-skew-wrap {
          position: relative;
          display: flex;
          align-items: center;
          isolation: isolate;
        }

        @keyframes p3-shadow-pop {
          0%   { transform: translateY(-40%) translateX(-12px) scaleX(0) scaleY(1); }
          55%  { transform: translateY(-46%) translateX(-15px) scaleX(1.22) scaleY(1.18); }
          75%  { transform: translateY(-39%) translateX(-11px) scaleX(0.96) scaleY(0.97); }
          100% { transform: translateY(-40%) translateX(-12px) scaleX(1) scaleY(1); }
        }

        .p3-shadow-tri {
          position: absolute;
          top: 50%;
          transform-origin: left center;
          background: rgba(235, 80, 120, 0.85);
          z-index: 1;
          pointer-events: none;
          transform: translateY(-40%) translateX(-12px) scaleX(0);
          transition: transform 0.18s ease;
        }
        .p3-shadow-tri.pop {
          animation: p3-shadow-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .p3-highlight {
          position: absolute;
          top: 50%;
          transform-origin: left center;
          background: #ffffff;
          z-index: 2;
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
        }

        .p3-label-wrap {
          position: relative;
          z-index: 3;
        }

        .p3-label-base {
          font-family: 'Anton', sans-serif;
          font-style: italic;
          letter-spacing: 2px;
          line-height: 0.85;
          display: block;
          white-space: nowrap;
          user-select: none;
        }

        .p3-label-dark {
          color: #3ce2ff;
          transition: color 0.12s ease;
        }
        .p3-row.active .p3-label-dark { color: #6b0010; }
        .p3-row:hover:not(.active) .p3-label-dark { color: #00d9ff; }

        .p3-label-bright {
          color: #ff2a2a;
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0;
          transition: opacity 0.12s ease;
        }
        .p3-row.active .p3-label-bright { opacity: 1; }

        .p3-hint {
          position: absolute;
          bottom: 24px; right: 28px;
          z-index: 20;
          display: flex; flex-direction: column;
          align-items: flex-end; gap: 5px;
          font-family: 'Anton', sans-serif;
          opacity: 0;
          transition: opacity 0.5s ease 0.9s;
        }
        .p3-hint.mounted { opacity: 1; }
        .p3-hint-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; letter-spacing: 2px;
          color: rgba(255,255,255,0.28);
        }
        .p3-hint-key {
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 3px;
          padding: 1px 6px; font-size: 11px;
        }

        .p3-name-tag {
          position: absolute;
          top: 18px;
          left: 22px;
          z-index: 20;
          font-family: 'Anton', sans-serif;
          font-style: italic;
          font-size: 108px;
          line-height: 0.88;
          letter-spacing: 2px;
          color: rgba(10, 10, 14, 0.64);
          transform: rotate(18deg);
          transform-origin: left top;
          user-select: none;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .p3-name-tag span:first-child {
          color: rgba(0, 0, 0, 0.86);
        }

        .p3-scanlines {
          position: absolute;
          inset: 0;
          z-index: 15;
          pointer-events: none;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%);
          background-size: 100% 4px;
        }

        .p3-clock {
          position: absolute;
          top: 30px;
          right: 40px;
          z-index: 20;
          font-family: 'Anton', sans-serif;
          color: rgba(255,255,255,0.8);
          text-align: right;
          transform: skewX(-10deg);
        }
        .p3-clock .date { font-size: 24px; color: #ff2a2a; letter-spacing: 2px; }
        .p3-clock .time { font-size: 48px; line-height: 0.9; }

        .p3-solar-widget {
          position: absolute;
          top: 130px;
          right: 40px;
          z-index: 20;
          font-family: monospace;
          color: #00d9ff;
          background: rgba(0, 20, 40, 0.6);
          border-right: 4px solid #ff2a2a;
          padding: 12px 20px;
          transform: skewX(-10deg);
          font-size: 13px;
          line-height: 1.6;
          backdrop-filter: blur(4px);
          text-align: right;
        }

        .p3-quick-actions {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%) skewX(-15deg);
          z-index: 20;
          display: flex;
          gap: 20px;
          pointer-events: auto;
        }
        .p3-quick-btn {
          background: rgba(0, 0, 0, 0.5);
          color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 8px 24px;
          font-family: 'Anton', sans-serif;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .p3-quick-btn:hover {
          background: #ff2a2a;
          color: #fff;
          border-color: #ff2a2a;
        }
      `}</style>

      <div className="p3-overlay">
        <div className="p3-scanlines" />
        
        <div className="p3-clock">
          <div className="date">
            {String(time.getMonth() + 1).padStart(2, '0')} / {String(time.getDate()).padStart(2, '0')} {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][time.getDay()]}
          </div>
          <div className="time">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </div>
        </div>

        <div className="p3-name-tag">
          <span>SOLTRA</span>
          <span style={{ color: '#00d9ff' }}>SYSTEM</span>
        </div>
        <div className="p3-stripe" />
        <div className="p3-stripe2" />

        <nav className="p3-menu">
          {ITEMS.map((item, i) => {
            const isActive = active === i;
            const dist = Math.abs(i - active);
            const opacity = isActive ? 1 : Math.max(0.5, 1 - dist * 0.2);
            const estW = item.label.length * item.fontSize * 0.6 + 80;
            const estH = item.fontSize * 0.94;
            const clipFn = CLIP_SHAPES[i] ?? CLIP_SHAPES[0];

            return (
              <a
                key={item.id}
                href="#"
                className={`p3-row ${isActive ? "active" : ""} ${mounted ? "mounted" : ""}`}
                style={{
                  marginRight: item.offsetX,
                  marginTop: item.offsetY,
                  transitionDelay: mounted ? `${i * 80}ms` : "0ms",
                }}
                onClick={(e) => { e.preventDefault(); onNavigate?.(item.page); }}
                onMouseEnter={() => activate(i)}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="p3-glow" />
                <div
                  className="p3-skew-wrap"
                  style={{ transform: `skewX(${item.skew}deg) skewY(${item.skewY}deg)` }}
                >
                  <div
                    key={isActive ? `pop-${i}-${animKey}` : `idle-${i}`}
                    className={`p3-shadow-tri${isActive ? ' pop' : ''}`}
                    style={{
                      width: estW,
                      height: estH,
                      clipPath: clipFn(estW, estH),
                    }}
                  />
                  <div
                    className="p3-highlight"
                    style={{
                      width: estW,
                      height: estH,
                      clipPath: clipFn(estW, estH),
                      transform: `translateY(-50%) scaleX(${isActive ? 1 : 0})`,
                    }}
                  />
                  <div className="p3-label-wrap" style={{ opacity }}>
                    <span className="p3-label-base p3-label-dark" style={{ fontSize: item.fontSize }}>
                      {item.label}
                    </span>
                    <span
                      className="p3-label-base p3-label-bright"
                      style={{
                        fontSize: item.fontSize,
                        clipPath: clipFn(estW, estH),
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </nav>

        <div className={`p3-hint ${mounted ? "mounted" : ""}`}>
          <div className="p3-hint-row"><span style={{ color: '#00d9ff' }}>●</span><span>UPLINK: STABLE</span></div>
          <div className="p3-hint-row"><span className="p3-hint-key">↑↓</span><span>NAVIGATE</span></div>
          <div className="p3-hint-row"><span className="p3-hint-key">↵</span><span>CONFIRM</span></div>
        </div>

        <div className="p3-solar-widget">
          <div>&gt; TELEMETRY LINK ESTABLISHED</div>
          <div>LUX: <span style={{ color: '#fff' }}>85,420 lx</span></div>
          <div>PANELS: <span style={{ color: '#fff' }}>OPTIMIZED</span></div>
          <div>WIND: <span style={{ color: '#fff' }}>12 km/h</span></div>
        </div>

        <div className="p3-quick-actions">
          <button className="p3-quick-btn" onClick={() => setShowVoiceCloning(true)}>VOICE CLONE</button>
          <button className="p3-quick-btn" onClick={() => onNavigate?.("settings")}>SETTINGS</button>
          <button className="p3-quick-btn" onClick={() => {
            window.location.href = "/";
          }}>LOGOUT</button>
        </div>
      </div>
      
      <AnimatePresence>
        {showVoiceCloning && (
          <VoiceCloningModule onClose={() => setShowVoiceCloning(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
