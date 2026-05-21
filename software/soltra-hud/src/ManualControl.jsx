import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Zap, Power, ShieldAlert } from 'lucide-react';

export default function ManualControl() {
  const navigate = useNavigate();
  const [motorX, setMotorX] = useState(180);
  const [motorY, setMotorY] = useState(45);
  const [power, setPower] = useState(true);

  const btnStyle = {
    background: 'rgba(255, 42, 42, 0.1)',
    border: '1px solid rgba(255, 42, 42, 0.4)',
    color: '#ff2a2a',
    padding: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: '#000', 
      color: '#00d9ff', 
      fontFamily: "'Anton', sans-serif",
      letterSpacing: '2px',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #ff2a2a', paddingBottom: '20px', marginBottom: '40px' }}>
        <div style={{ fontSize: '32px', fontStyle: 'italic' }}>
          <Settings style={{ verticalAlign: 'middle', marginRight: '12px' }} />
          MANUAL HARDWARE OVERRIDE
        </div>
        <button 
          onClick={() => navigate('/hub')}
          style={{ ...btnStyle, background: '#ff2a2a', color: '#fff', padding: '8px 24px' }}
        >
          EXIT TO HUB
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', flex: 1 }}>
        {/* Left: Motor Controls */}
        <div style={{ background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 217, 255, 0.2)', padding: '30px', position: 'relative' }}>
          <div style={{ fontSize: '20px', color: '#fff', marginBottom: '30px', borderLeft: '4px solid #ff2a2a', paddingLeft: '12px' }}>ACTUATOR MATRIX</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
             <button style={btnStyle} onClick={() => setMotorY(y => Math.min(90, y + 5))}><ArrowUp /></button>
             <div style={{ display: 'flex', gap: '20px' }}>
                <button style={btnStyle} onClick={() => setMotorX(x => (x - 5 + 360) % 360)}><ArrowLeft /></button>
                <div style={{ width: '120px', height: '120px', border: '2px dashed #00d9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  {motorX}° / {motorY}°
                </div>
                <button style={btnStyle} onClick={() => setMotorX(x => (x + 5) % 360)}><ArrowRight /></button>
             </div>
             <button style={btnStyle} onClick={() => setMotorY(y => Math.max(0, y - 5))}><ArrowDown /></button>
          </div>

          <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
             <button style={{ ...btnStyle, background: 'rgba(0,217,255,0.1)', color: '#00d9ff', borderColor: '#00d9ff' }} onClick={() => { setMotorX(180); setMotorY(45); }}>
               <Home size={16} style={{ marginRight: '8px' }} /> HOME SENSORS
             </button>
             <button style={{ ...btnStyle, background: power ? 'rgba(0,255,65,0.1)' : 'rgba(255,42,42,0.1)', color: power ? '#00ff41' : '#ff2a2a', borderColor: power ? '#00ff41' : '#ff2a2a' }} onClick={() => setPower(!power)}>
               <Power size={16} style={{ marginRight: '8px' }} /> {power ? 'SYS POWER: ON' : 'SYS POWER: OFF'}
             </button>
          </div>
        </div>

        {/* Right: Diagnostics */}
        <div style={{ background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 217, 255, 0.2)', padding: '30px' }}>
          <div style={{ fontSize: '20px', color: '#fff', marginBottom: '30px', borderLeft: '4px solid #00d9ff', paddingLeft: '12px' }}>DIAGNOSTICS</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontFamily: 'monospace', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&gt; L_ACTUATOR_1</span><span style={{ color: '#00ff41' }}>NOMINAL</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&gt; L_ACTUATOR_2</span><span style={{ color: '#00ff41' }}>NOMINAL</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&gt; VOLTAGE_BUS</span><span style={{ color: '#00ff41' }}>24.2V</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&gt; CURRENT_DRAW</span><span style={{ color: '#e8c100' }}>1.4A</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&gt; TEMP_MOSFET</span><span style={{ color: '#00ff41' }}>42°C</span></div>
            
            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,42,42,0.05)', border: '1px solid rgba(255,42,42,0.2)' }}>
              <div style={{ color: '#ff2a2a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldAlert size={14} /> WARNING: MANUAL OVERRIDE
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.4' }}>
                AUTOMATIC SAFETY LIMITS HAVE BEEN DISENGAGED. ENSURE CLEARANCE OF ALL MECHANICAL COMPONENTS BEFORE INITIATING MOVEMENT.
              </div>
            </div>
            
            <div style={{ flex: 1 }} />
            <button style={{ ...btnStyle, width: '100%', background: '#ff2a2a', color: '#fff', fontSize: '20px', padding: '20px' }}>
              <Zap style={{ marginRight: '12px' }} /> EMERGENCY STOP
            </button>
          </div>
        </div>
      </div>

      {/* Footer Decoration */}
      <div style={{ position: 'absolute', bottom: '20px', left: '40px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
        SYS_VER: 4.2.0-STABLE // HARDWARE_ID: SOLTRA-T1-N1
      </div>
    </div>
  );
}
