import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Volume2, Mic, Eye, Shield, Save, X } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [volume, setVolume] = useState(80);
  const [sensitivity, setSensitivity] = useState(65);
  const [voiceProfile, setVoiceProfile] = useState('Default AI');
  const [shaderMode, setShaderMode] = useState('TOON');

  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('soltra_settings') || '{}');
    if (savedSettings.volume !== undefined) setVolume(savedSettings.volume);
    if (savedSettings.sensitivity !== undefined) setSensitivity(savedSettings.sensitivity);
    if (savedSettings.voiceProfile) setVoiceProfile(savedSettings.voiceProfile);
    if (savedSettings.shaderMode) setShaderMode(savedSettings.shaderMode);
  }, []);

  const handleSave = () => {
    const settings = {
      volume,
      sensitivity,
      voiceProfile,
      shaderMode
    };
    localStorage.setItem('soltra_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('settings_changed'));
    navigate('/');
  };

  const containerStyle = {
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
  };

  const sectionStyle = {
    background: 'rgba(0, 10, 20, 0.8)',
    border: '1px solid rgba(0, 217, 255, 0.2)',
    padding: '24px',
    marginBottom: '20px',
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(0, 40, 60, 0.4)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    color: '#fff',
    padding: '10px',
    fontFamily: 'monospace',
    marginTop: '8px'
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #00d9ff', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ fontSize: '32px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Settings size={32} /> SYSTEM CONFIGURATION
        </div>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'transparent', border: '1px solid #ff2a2a', color: '#ff2a2a', padding: '8px 24px', cursor: 'pointer', fontFamily: "'Anton', sans-serif" }}
        >
          DISCARD
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', marginBottom: '20px', borderLeft: '4px solid #ff2a2a', paddingLeft: '12px' }}>
            <Volume2 size={18} /> AUDIO OUTPUT
          </div>
          <div>
            <label style={{ fontSize: '12px' }}>MASTER VOLUME: {volume}%</label>
            <input 
              type="range" 
              value={volume} 
              onChange={(e) => setVolume(parseInt(e.target.value))} 
              style={{ width: '100%', accentColor: '#ff2a2a', marginTop: '10px' }} 
            />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', marginBottom: '20px', borderLeft: '4px solid #ff2a2a', paddingLeft: '12px' }}>
            <Mic size={18} /> VOICE & LINGUISTICS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>ACTIVE VOICE PROFILE</label>
              <select 
                value={voiceProfile} 
                onChange={(e) => setVoiceProfile(e.target.value)}
                style={inputStyle}
              >
                <option value="Default AI">Default AI</option>
                <option value="Overseer Prime">Overseer Prime</option>
                <option value="Neural Echo">Neural Echo</option>
                <option value="Custom Clone V1">Custom Clone V1</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>MIC SENSITIVITY: {sensitivity}%</label>
              <input 
                type="range" 
                value={sensitivity} 
                onChange={(e) => setSensitivity(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#00d9ff', marginTop: '10px' }} 
              />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', marginBottom: '20px', borderLeft: '4px solid #ff2a2a', paddingLeft: '12px' }}>
            <Eye size={18} /> VISUAL ENGINE
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            {['REALISTIC', 'TOON', 'HOLOGRAM'].map(mode => (
              <button 
                key={mode}
                onClick={() => setShaderMode(mode)}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: shaderMode === mode ? 'rgba(0,217,255,0.2)' : 'transparent',
                  border: `1px solid ${shaderMode === mode ? '#00d9ff' : 'rgba(255,255,255,0.1)'}`,
                  color: shaderMode === mode ? '#00d9ff' : '#fff',
                  cursor: 'pointer',
                  fontFamily: "'Anton', sans-serif"
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
          <button 
            onClick={handleSave}
            style={{ 
              flex: 1, 
              background: '#00d9ff', 
              color: '#000', 
              border: 'none', 
              padding: '18px', 
              fontSize: '20px', 
              cursor: 'pointer', 
              fontFamily: "'Anton', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <Save size={20} /> COMMIT CHANGES
          </button>
        </div>

      </div>
    </div>
  );
}
