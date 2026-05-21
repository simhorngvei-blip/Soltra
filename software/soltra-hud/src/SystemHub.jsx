import { Suspense, useState, Component, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Loader } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Crosshair, Cpu, Battery, Activity, Sun, Wind, User, Bot, Mic } from 'lucide-react';
import './App.css';
import DigitalTwinEnv from './components/DigitalTwinEnv';
import VrmAvatar from './components/VrmAvatar';
import VoiceCloningModule from './components/VoiceCloningModule';
import { processCommand } from './utils/llmService';
import { generateVoiceboxTTS, checkVoiceboxHealth } from './utils/ttsService';
import hubVideo from './assets/main1.mp4';
import { useNavigate } from 'react-router-dom';
import { useSoltraTelemetry } from './hooks/useSoltraTelemetry';

/* ─── Error Boundary: isolates Canvas crashes from the UI overlay ─── */
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.warn('[Soltra] 3D Canvas error caught by boundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000000',
            color: '#00FF41',
            fontSize: '13px',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          [ERR] 3D ENGINE FAULT // WEBGL CONTEXT LOST
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── R3F Scene (safely isolated inside the Canvas) ─── */
function Scene({ animationName, expressionName, isTalking, audioAnalyser }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      {/* Main key light - cooler color for industrial vibe */}
      <directionalLight position={[5, 10, 5]} intensity={1.5} color="#e0f2fe" castShadow />
      {/* Fill light */}
      <directionalLight position={[-5, 0, -5]} intensity={0.5} color="#00d9ff" />

      <Suspense fallback={null}>
        <DigitalTwinEnv position={[6.5, -0.95, 0]} scale={0.18} />
        <VrmAvatar 
          position={[0, -1, 1.0]} 
          scale={1.05} 
          animationName={animationName}
          expressionName={expressionName}
          shaderMode={shaderMode}
          isTalking={isTalking}
          audioAnalyser={audioAnalyser}
        />
      </Suspense>

      <OrbitControls
        target={[0, 0.7, 0]}
        minDistance={1.5}
        maxDistance={4.5}
        minPolarAngle={Math.PI / 2.2}
        maxPolarAngle={Math.PI / 1.8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 3.5}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.05}
      />
    </>
  );
}

/* ─── Main App ─────────────────────────────────────────────────────── */
export default function SystemHub() {
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'SYSTEM INITIALIZED. AWAITING OPERATOR INPUT.' }
  ]);
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [currentExpression, setCurrentExpression] = useState('neutral');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState(null);
  const [voiceboxStatus, setVoiceboxStatus] = useState({ online: false });
  const [ttsMode, setTtsMode] = useState('unknown'); // 'voicebox' | 'browser' | 'unknown'
  const [showVoiceCloning, setShowVoiceCloning] = useState(false);
  const { telemetry, loading } = useSoltraTelemetry();
  const [masterVolume, setMasterVolume] = useState(80);
  const [shaderMode, setShaderMode] = useState('TOON');
  
  const scrollRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Load settings
  useEffect(() => {
    const loadSettings = () => {
      const settings = JSON.parse(localStorage.getItem('soltra_settings') || '{}');
      if (settings.volume !== undefined) setMasterVolume(settings.volume);
      if (settings.shaderMode) setShaderMode(settings.shaderMode);
    };
    loadSettings();
    window.addEventListener('settings_changed', loadSettings);
    return () => window.removeEventListener('settings_changed', loadSettings);
  }, []);

  // Voicebox health probe — check on mount and every 30s
  useEffect(() => {
    const probe = async () => {
      const status = await checkVoiceboxHealth();
      setVoiceboxStatus(status);
      setTtsMode(status.online ? 'voicebox' : 'browser');
    };
    probe();
    const interval = setInterval(probe, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isProcessing) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsProcessing(true);

    try {
      const response = await processCommand(userMsg);
      
      // Update bot message
      setMessages(prev => [...prev, { role: 'bot', text: response.text }]);
      
      // Update avatar state
      setCurrentExpression(response.expression || 'neutral');
      setIsTalking(true);
      
      // Setup Audio Context for Analyser (Web Audio API)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioCtx = audioCtxRef.current;
      // Resume context in case browser suspended it
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      setAudioAnalyser(analyser);

      // Function to trigger the fallback Web Speech TTS
      const triggerFallbackTTS = () => {
        // Create an oscillator to represent "Data Speech" for the analyser to drive lip-sync
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, audioCtx.currentTime);
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(50, audioCtx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
        
        oscillator.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        oscillator.start();
        lfo.start();

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(response.text);
          utterance.rate = 1.0;
          utterance.pitch = 0.8;
          utterance.volume = masterVolume / 100;
          
          const cleanupAudio = () => {
            setIsTalking(false);
            try { oscillator.stop(); lfo.stop(); } catch(e) {}
            setAudioAnalyser(null);
          };

          utterance.onend = cleanupAudio;
          utterance.onerror = cleanupAudio;
          window.speechSynthesis.speak(utterance);
        } else {
          const wordCount = response.text.split(' ').length;
          const duration = Math.max(2000, wordCount * 150);
          setTimeout(() => {
            setIsTalking(false);
            try { oscillator.stop(); lfo.stop(); } catch(e) {}
            setAudioAnalyser(null);
          }, duration);
        }
      };

      // Try Voicebox TTS First
      try {
        const audioBuffer = await generateVoiceboxTTS(response.text);
        const decodedData = await audioCtx.decodeAudioData(audioBuffer);
        
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = decodedData;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = masterVolume / 100;

        // Connect Voicebox audio directly to Analyser (this perfectly drives real lip sync!)
        sourceNode.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        sourceNode.onended = () => {
          setIsTalking(false);
          setAudioAnalyser(null);
        };
        
        sourceNode.start(0);
        setTtsMode('voicebox');
      } catch (err) {
        // Fallback to native speech synthesis with data-tone oscillator
        console.warn('Voicebox failed, falling back to Web Speech API', err);
        setTtsMode('browser');
        triggerFallbackTTS();
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'ERROR: LLM UPLINK TIMEOUT.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Animation variants for the HUD entrances
  const hudVariants = {
    hidden: { opacity: 0, y: -20, filter: 'blur(10px)' },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const sidePanelVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.5, ease: 'easeOut', delay: 0.3 }
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.5, ease: 'easeOut', delay: 0.5 }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* ── Background Video ── */}
      <video 
        src={hubVideo} 
        autoPlay 
        loop 
        muted 
        playsInline 
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, zIndex: 0 }}
      />

      {/* ── Scanlines ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        pointerEvents: 'none',
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)',
        backgroundSize: '100% 4px',
        opacity: 0.3
      }} />

      {/* ── 3D Canvas ── */}
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 0.8, 5], fov: 50 }}
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        >
          <Scene 
            animationName={currentAnimation} 
            expressionName={currentExpression}
            isTalking={isTalking}
            audioAnalyser={audioAnalyser}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <Loader containerStyles={{ background: 'rgba(0,0,0,0.8)' }} dataStyles={{ color: '#00d9ff', fontFamily: "'Anton', sans-serif", fontStyle: 'italic', letterSpacing: '2px' }} />

      {/* ── UI Overlay ─────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          pointerEvents: 'none',
          zIndex: 10,
          fontFamily: "'Anton', sans-serif",
          letterSpacing: '2px',
          color: '#00d9ff'
        }}
      >
        {/* Top Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          
          <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%) skewX(-15deg)', pointerEvents: 'auto' }}>
            <button 
              onClick={() => navigate('/hub')}
              style={{
                background: 'rgba(255,42,42,0.8)',
                color: '#fff',
                border: 'none',
                padding: '8px 32px',
                fontFamily: "'Anton', sans-serif",
                fontSize: '18px',
                cursor: 'pointer',
                clipPath: 'polygon(0 0, 100% 0, 85% 100%, 15% 100%)',
                boxShadow: '0 4px 15px rgba(255,42,42,0.4)'
              }}
            >
              BACK TO COMMAND CENTER
            </button>
          </div>

          {/* Top-left: System Status HUD + Voice Cloning button wrapper (no skew on button) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', pointerEvents: 'auto' }}>
            <motion.div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                background: 'rgba(0, 10, 20, 0.75)', 
                borderRight: '4px solid #ff2a2a',
                borderBottom: '1px solid rgba(0, 217, 255, 0.3)', 
                padding: '20px', 
                borderRadius: '0px', 
                backdropFilter: 'blur(8px)',
                transform: 'skewX(-10deg)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                position: 'relative',
              }}
              initial="hidden"
              animate="visible"
              variants={hudVariants}
            >
              <div style={{ position: 'absolute', top: '-2px', left: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
              <div style={{ position: 'absolute', top: '-2px', right: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
              <div style={{ position: 'absolute', bottom: '-2px', left: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #00d9ff', paddingBottom: '8px' }}>
                <Terminal size={18} color="#ff2a2a" />
                <span style={{ fontStyle: 'italic', color: '#fff', fontSize: '20px' }}>
                  SYS.SOLTRA.CMD // ONLINE
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>TTS ENGINE:</span><span style={{ color: voiceboxStatus.online ? '#00ff41' : '#ff2a2a' }}>{voiceboxStatus.online ? 'ONLINE' : 'OFFLINE'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>MODEL:</span><span style={{ color: voiceboxStatus.modelLoaded ? '#00ff41' : '#fff' }}>{voiceboxStatus.online ? (voiceboxStatus.modelLoaded ? 'LOADED' : (voiceboxStatus.modelLoading ? 'WARMING...' : 'STANDBY')) : '---'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>GPU:</span><span style={{ color: voiceboxStatus.gpuAvailable ? '#00d9ff' : '#fff' }}>{voiceboxStatus.online ? (voiceboxStatus.gpu || 'CPU') : '---'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>VOICE:</span><span style={{ color: ttsMode === 'voicebox' ? '#00d9ff' : '#ff2a2a' }}>
                  {ttsMode === 'voicebox' ? 'AI CLONE' : ttsMode === 'browser' ? 'BROWSER FALLBACK' : 'DETECTING...'}
                </span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>PROFILES:</span><span style={{ color: '#00d9ff' }}>{voiceboxStatus.online ? (voiceboxStatus.profilesCount ?? 0) : '---'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '200px' }}><span>UPLINK:</span><span style={{ color: isProcessing ? '#00d9ff' : '#ff2a2a' }}>
                  {isProcessing ? "PROCESSING..." : "STANDBY"}
                </span></div>
              </div>
              
              {/* Hardware Expression Toggles */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: '#fff' }}>
                  FACIAL SERVO OVERRIDE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['neutral', 'happy', 'relaxed', 'surprised'].map((exp) => (
                    <button
                      key={exp}
                      onClick={() => setCurrentExpression(exp)}
                      style={{
                        background: currentExpression === exp ? 'rgba(0,217,255,0.2)' : 'transparent',
                        border: `1px solid ${currentExpression === exp ? '#00d9ff' : 'rgba(255,255,255,0.2)'}`,
                        color: currentExpression === exp ? '#00d9ff' : '#fff',
                        padding: '4px 8px',
                        fontFamily: "'Anton', sans-serif",
                        cursor: 'pointer',
                        fontSize: '12px',
                        textTransform: 'uppercase'
                      }}
                    >
                      [{exp.substring(0, 3)}]
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Voice Cloning Button — sits OUTSIDE the skewed panel so click area is accurate */}
            <button
              id="voice-cloning-btn"
              onClick={() => setShowVoiceCloning(true)}
              style={{
                marginTop: '8px',
                width: '100%',
                background: 'rgba(255,42,42,0.15)',
                border: '1px solid rgba(255,42,42,0.5)',
                borderTop: '2px solid #ff2a2a',
                color: '#ff2a2a',
                padding: '10px 12px',
                fontFamily: "'Anton', sans-serif",
                fontSize: '13px',
                letterSpacing: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)',
                background: 'rgba(0, 10, 20, 0.85)',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,42,42,0.25)'; e.currentTarget.style.borderColor = '#ff2a2a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,10,20,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,42,42,0.5)'; }}
            >
              <Mic size={14} /> VOICE CLONING
            </button>
          </div>

          {/* Top-Right: Telemetry Data & Chat History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-end' }}>
            <motion.div 
              style={{ 
                pointerEvents: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                background: 'rgba(0, 10, 20, 0.75)', 
                borderLeft: '4px solid #ff2a2a',
                borderBottom: '1px solid rgba(0, 217, 255, 0.3)', 
                padding: '20px', 
                borderRadius: '0px', 
                width: '240px', 
                backdropFilter: 'blur(8px)',
                transform: 'skewX(10deg)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
               <div style={{ position: 'absolute', top: '-2px', left: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
               <div style={{ position: 'absolute', top: '-2px', right: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
               <div style={{ position: 'absolute', bottom: '-2px', left: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>
               <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}><Crosshair size={12} color="#ff2a2a" /></div>

               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #00d9ff', paddingBottom: '8px', fontStyle: 'italic' }}>
                  <Activity size={16} color="#ff2a2a" />
                  <span style={{ color: '#fff', fontSize: '18px' }}>SENSOR FUSION</span>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#fff' }}>
                     <Wind size={12}/> WIND SPD
                   </div>
                   <div style={{ fontSize: '16px', color: '#00d9ff' }}>{telemetry.wind} m/s</div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#fff' }}>
                     <Sun size={12}/> IRRADIANCE
                   </div>
                   <div style={{ fontSize: '16px', color: '#ff2a2a' }}>{telemetry.irradiance} W/m²</div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#fff' }}>
                     <Crosshair size={12}/> AZIMUTH
                   </div>
                   <div style={{ fontSize: '16px', color: '#00d9ff' }}>{telemetry.azimuth}°</div>
                 </div>
               </div>
            </motion.div>

            {/* Chat History Box */}
            <motion.div 
              style={{ 
                pointerEvents: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                background: 'rgba(0, 10, 20, 0.75)', 
                borderLeft: '4px solid #00d9ff',
                borderBottom: '1px solid rgba(0, 217, 255, 0.3)', 
                padding: '20px', 
                borderRadius: '0px', 
                width: '360px', 
                height: '300px', 
                backdropFilter: 'blur(8px)',
                transform: 'skewX(5deg)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
              <div style={{ position: 'absolute', top: '-2px', left: '-2px' }}><Crosshair size={12} color="#00d9ff" /></div>
              <div style={{ position: 'absolute', top: '-2px', right: '-2px' }}><Crosshair size={12} color="#00d9ff" /></div>
              <div style={{ position: 'absolute', bottom: '-2px', left: '-2px' }}><Crosshair size={12} color="#00d9ff" /></div>
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}><Crosshair size={12} color="#00d9ff" /></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #ff2a2a', paddingBottom: '8px', fontStyle: 'italic' }}>
                <Activity size={16} color="#00d9ff" />
                <span style={{ color: '#fff', fontSize: '18px' }}>COMM LOG</span>
              </div>
              <div 
                ref={scrollRef}
                style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}
              >
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#fff' }}>
                        {msg.role === 'user' ? <><User size={10}/> OPERATOR</> : <><Bot size={10}/> SOLTRA</>}
                      </div>
                      <div style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        background: msg.role === 'user' ? 'rgba(0,217,255,0.1)' : 'rgba(255,42,42,0.1)',
                        color: msg.role === 'user' ? '#00d9ff' : '#ff2a2a',
                        borderRight: msg.role === 'user' ? '2px solid #00d9ff' : 'none',
                        borderLeft: msg.role !== 'user' ? '2px solid #ff2a2a' : 'none',
                        fontFamily: "monospace",
                        letterSpacing: '0px'
                      }}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isProcessing && (
                  <div style={{ color: '#00d9ff', fontSize: '11px', fontStyle: 'italic' }}>
                    &gt; RECEIVING DATA...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom-center: Terminal Input */}
        <motion.div 
          style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'center', width: '100%' }}
          initial="hidden"
          animate="visible"
          variants={inputVariants}
        >
          <div style={{ display: 'flex', width: '100%', maxWidth: '700px', background: 'rgba(0, 10, 20, 0.8)', border: '1px solid rgba(0, 217, 255, 0.4)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', background: 'rgba(0,217,255,0.1)', borderRight: '1px solid rgba(0,217,255,0.4)' }}>
              <Cpu size={18} color="#00d9ff" />
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px' }}>
              <span style={{ color: '#00d9ff' }}>&gt;</span>
              <input
                id="soltra-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                disabled={isProcessing}
                placeholder={isProcessing ? "TRANSMITTING..." : "AWAITING COMMAND..."}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontFamily: "monospace",
                  outline: 'none',
                  fontSize: '14px'
                }}
                autoFocus
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={isProcessing}
              style={{
                background: isProcessing ? 'rgba(255,42,42,0.2)' : '#ff2a2a',
                color: isProcessing ? '#ff2a2a' : '#fff',
                border: 'none',
                padding: '0 24px',
                fontFamily: "'Anton', sans-serif",
                fontSize: '16px',
                letterSpacing: '2px',
                cursor: isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              {isProcessing ? "WAIT" : "EXECUTE"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Voice Cloning Modal */}
      <AnimatePresence>
        {showVoiceCloning && (
          <VoiceCloningModule onClose={() => setShowVoiceCloning(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
