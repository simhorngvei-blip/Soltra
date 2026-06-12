import { Suspense, useState, Component, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Loader } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Crosshair, Cpu, Battery, Activity, Sun, Wind, User, Bot, X } from 'lucide-react';
import './App.css';
import DigitalTwinEnv from './components/DigitalTwinEnv';
import VrmAvatar from './components/VrmAvatar';
import { processCommand } from './utils/llmService';
import { generateVoiceboxTTS } from './utils/ttsService';
import hubVideo from './assets/main1.mp4';
import { useSoltraTelemetry } from './hooks/useSoltraTelemetry';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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
            color: '#ff2a2a',
            fontSize: '13px',
            fontFamily: "'Anton', sans-serif",
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
function Scene({ animationName, expressionName, shaderMode, isTalking, audioAnalyser }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      {/* Main key light - cooler color for industrial vibe */}
      <directionalLight position={[5, 10, 5]} intensity={1.5} color="#e0f2fe" castShadow />
      {/* Fill light - Cyan for AI Overseer vibe */}
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
export default function App() {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'SYSTEM INITIALIZED. AWAITING OPERATOR INPUT.' }
  ]);
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [currentExpression, setCurrentExpression] = useState('neutral');
  const [shaderMode, setShaderMode] = useState('toon');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const { telemetry, telemetryHistory, loading, sysError } = useSoltraTelemetry();
  const [weather, setWeather] = useState({ temp: '--', condition: 'Loading', location: 'KUALA LUMPUR' });
  const [showCamera, setShowCamera] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState(null);
  
  
  const scrollRef = useRef(null);
  const audioCtxRef = useRef(null);

  if (sysError) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-[14px] font-mono tracking-[0.4em] text-zinc-600 uppercase mb-4">
            SOLTRA PROTOCOL // OVERSEER
          </div>
          <div className="font-sans text-[6vw] leading-none text-red-500/80 uppercase italic select-none" style={{ letterSpacing: '-0.04em' }}>
            OFFLINE
          </div>
          <div className="mt-4 text-xs font-mono text-red-400 uppercase tracking-widest bg-red-950/30 px-4 py-2 border border-red-900/40 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            {sysError}
          </div>
        </div>
      </div>
    );
  }

  // Weather Fetch (Open-Meteo)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=3.1390&longitude=101.6869&current_weather=true');
        const data = await res.json();
        const code = data.current_weather.weathercode;
        // Simple condition mapping
        let condition = 'CLEAR';
        if (code > 0 && code <= 3) condition = 'CLOUDS';
        if (code >= 45 && code <= 48) condition = 'FOG';
        if (code >= 51 && code <= 67) condition = 'RAIN';
        if (code >= 71 && code <= 77) condition = 'SNOW';
        if (code >= 95) condition = 'THUNDERSTORM';
        
        setWeather({ temp: data.current_weather.temperature, condition, location: 'KUALA LUMPUR' });
      } catch (e) {
        console.error('Weather fetch error', e);
        setWeather({ temp: 'ERR', condition: 'OFFLINE', location: 'KUALA LUMPUR' });
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 mins
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
      setCurrentExpression(response.expression || 'neutral');
      
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
        
        // Connect Voicebox audio directly to Analyser (this perfectly drives real lip sync!)
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        sourceNode.onended = () => {
          setIsTalking(false);
          setAudioAnalyser(null);
        };
        
        sourceNode.start(0);
      } catch (err) {
        // Fallback to native speech synthesis with data-tone oscillator
        console.warn('Voicebox failed, falling back to Web Speech API', err);
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
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* ── Background Video ── */}
      <video 
        src={hubVideo} 
        autoPlay 
        loop 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-50 z-0"
      />

      {/* Global CRT Scanline Overlay */}
      <div className="scanline-overlay" />

      {/* ── 3D Canvas ── */}
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 0.8, 5], fov: 50 }}
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000300'); // Very dark green/black
          }}
        >
          <Scene 
            animationName={currentAnimation} 
            expressionName={currentExpression}
            shaderMode={shaderMode}
            isTalking={isTalking}
            audioAnalyser={audioAnalyser}
          />
        </Canvas>
      </CanvasErrorBoundary>

      <Loader containerStyles={{ background: '#000' }} dataStyles={{ color: '#00d9ff', fontFamily: "'Anton', sans-serif" }} />

      {/* ── UI Overlay ─────────── */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 z-10"
      >
        {/* Top Section */}
        <div className="flex justify-between items-start">
          
          {/* Top-left: System Status HUD */}
          <motion.div 
            className="pointer-events-auto flex flex-col gap-4 self-start max-w-[300px]"
            initial="hidden"
            animate="visible"
            variants={hudVariants}
          >
            <div className="hud-panel hud-panel-skew-left">
              {/* Corner Caps */}
              <Crosshair className="crosshair-corner cap-tl" size={12} />
              <Crosshair className="crosshair-corner cap-tr" size={12} />
              <Crosshair className="crosshair-corner cap-bl" size={12} />
              <Crosshair className="crosshair-corner cap-br" size={12} />

              <div className="hud-title">
                <Terminal size={18} color="#ff2a2a" />
                <span>SYS.SOLTRA.CMD // ONLINE</span>
                <span className="h-3 w-2 bg-[#ff2a2a] animate-pulse ml-auto"></span>
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="hud-data-row">
                  <span className="hud-data-label">UPLINK:</span>
                  <span className={isProcessing ? "text-[#00d9ff] animate-pulse" : "text-[#ff2a2a]"}>
                    {isProcessing ? "PROCESSING..." : "SECURE"}
                  </span>
                </div>
                <div className="hud-data-row">
                  <span className="hud-data-label">LATENCY:</span>
                  <span className="hud-data-value">{telemetry?.latency_ms != null ? `${telemetry.latency_ms}ms` : '—'}</span>
                </div>
                <div className="hud-data-row">
                  <span className="hud-data-label">UPTIME:</span>
                  <span className="hud-data-value">{telemetry?.uptime ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Visual Processing Panel */}
            <div className="hud-panel hud-panel-skew-left p-3">
               <Crosshair className="crosshair-corner cap-tl" size={10} />
               <Crosshair className="crosshair-corner cap-tr" size={10} />
               <Crosshair className="crosshair-corner cap-bl" size={10} />
               <Crosshair className="crosshair-corner cap-br" size={10} />

              <div className="text-[10px] font-mono text-[#fff] opacity-60 mb-2 uppercase tracking-widest">
                Visual Processing Unit
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['realistic', 'toon', 'hologram'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setShaderMode(mode)}
                    className={`hud-switch ${shaderMode === mode ? 'active' : ''}`}
                  >
                    {mode.substring(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Expression Toggles */}
            <div className="hud-panel hud-panel-skew-left p-3">
               <Crosshair className="crosshair-corner cap-tl" size={10} />
               <Crosshair className="crosshair-corner cap-tr" size={10} />
               <Crosshair className="crosshair-corner cap-bl" size={10} />
               <Crosshair className="crosshair-corner cap-br" size={10} />

              <div className="text-[10px] font-mono text-[#fff] opacity-60 mb-2 uppercase tracking-widest">
                Facial Servo Override
              </div>
              <div className="flex flex-col gap-2 mt-4 border-t border-[rgba(0,217,255,0.3)] pt-2">
                <div className="text-[10px] font-mono text-[#00d9ff] opacity-80 uppercase mb-1">AVAILABLE COMMANDS:</div>
                <div className="grid grid-cols-2 gap-2">
                  {['SYSTEM STATUS', 'SOLAR POSITION', 'WEATHER REPORT', 'SHADERS TOON', 'SHADERS REAL'].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => {
                        setChatInput(cmd);
                        setTimeout(() => document.getElementById('soltra-send-btn')?.click(), 50);
                      }}
                      className="bg-[rgba(0,217,255,0.05)] border border-[rgba(0,217,255,0.2)] text-[9px] font-mono text-white px-2 py-1 hover:bg-[rgba(0,217,255,0.2)] hover:border-[#00d9ff] transition-all text-left"
                    >
                      &gt; {cmd}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Top-Right: Telemetry Data & Chat History */}
          <div className="flex flex-col gap-4 items-end">
            {/* Weather Component */}
            <motion.div 
              className="pointer-events-auto hud-panel hud-panel-skew-right w-[240px] mb-2"
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
               <Crosshair className="crosshair-corner cap-tl" size={12} />
               <Crosshair className="crosshair-corner cap-tr" size={12} />
               <div className="hud-title">
                  <Sun size={16} color="#e8c100" />
                  <span>ENVIRONMENT</span>
               </div>
               <div className="flex justify-between items-center">
                 <div className="text-2xl text-white">{weather.temp}°C</div>
                 <div className="text-[10px] font-mono text-[#00d9ff] text-right">
                   {weather.condition.toUpperCase()}<br/>
                   {weather.location.toUpperCase()}
                 </div>
               </div>
            </motion.div>

            {/* System Health Panel */}
            <motion.div 
              className="pointer-events-auto hud-panel hud-panel-skew-right w-[240px] mb-2"
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
               <Crosshair className="crosshair-corner cap-tl" size={12} />
               <Crosshair className="crosshair-corner cap-tr" size={12} />
               <div className="hud-title">
                  <Activity size={16} color="#00d9ff" />
                  <span>SYSTEM HEALTH</span>
               </div>
               <div className="flex flex-col gap-2 mt-2">
                 {[
                   { id: 'NODE-01 (HUB)', status: 'online', lastSeen: new Date().toISOString() },
                   { id: 'NODE-02 (EAST)', status: 'online', lastSeen: new Date(Date.now() - 5000).toISOString() },
                   { id: 'NODE-03 (WEST)', status: 'offline', lastSeen: new Date(Date.now() - 3600000).toISOString() }
                 ].map(node => (
                   <div key={node.id} className="flex justify-between items-center text-[10px] font-mono border-b border-[rgba(255,255,255,0.1)] pb-1">
                     <div className="flex items-center gap-2">
                       <span className={`h-2 w-2 rounded-full ${node.status === 'online' ? 'bg-[#00d9ff] animate-pulse' : 'bg-[#ff2a2a]'}`}></span>
                       <span className="text-[#fff] opacity-80">{node.id}</span>
                     </div>
                     <span className="text-[#00d9ff] opacity-60">
                       {new Date(node.lastSeen).toLocaleTimeString([], { hour12: false })}
                     </span>
                   </div>
                 ))}
               </div>
            </motion.div>

            <motion.div 
              className="pointer-events-auto hud-panel hud-panel-skew-right w-[240px]"
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
               <Crosshair className="crosshair-corner cap-tl" size={12} />
               <Crosshair className="crosshair-corner cap-tr" size={12} />
               <Crosshair className="crosshair-corner cap-bl" size={12} />
               <Crosshair className="crosshair-corner cap-br" size={12} />

               <div className="hud-title">
                  <Activity size={16} color="#ff2a2a" />
                  <span>SENSOR FUSION</span>
               </div>
               
               <div className="flex flex-col gap-3">
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Wind size={12}/> WIND SPD
                   </div>
                   <div className="font-mono text-sm text-[#00d9ff]">{telemetry.wind ?? 'N/A'} m/s</div>
                 </div>

                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Battery size={12}/> BATTERY
                   </div>
                   <div className="font-mono text-sm text-[#00d9ff]">{telemetry.battery_pct != null ? `${telemetry.battery_pct}%` : 'N/A'}</div>
                 </div>

                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Activity size={12}/> OUTPUT PWR
                   </div>
                   <div className="font-mono text-sm text-[#00d9ff]">{telemetry.power_watts != null ? `${telemetry.power_watts} W` : 'N/A'}</div>
                 </div>

                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Sun size={12}/> IRRADIANCE (HISTORICAL)
                   </div>
                   <div className="font-mono text-sm text-[#ff2a2a]">{telemetry.irradiance} W/m²</div>
                   
                   {/* Mini Sparkline Graph */}
                   <div className="h-10 w-full mt-1 border-b border-[rgba(255,42,42,0.2)] relative overflow-hidden">
                      {loading ? (
                        <div className="text-[10px] text-[#ff2a2a] mt-2">AWAITING DATA...</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={telemetryHistory}>
                            <YAxis domain={['auto', 'auto']} hide />
                            <Line 
                              type="monotone" 
                              dataKey="irradiance" 
                              stroke="#ff2a2a" 
                              strokeWidth={2} 
                              dot={false} 
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                   </div>
                 </div>

                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Crosshair size={12}/> AZIMUTH
                   </div>
                   <div className="font-mono text-sm text-[#00d9ff]">{telemetry.azimuth ?? 'N/A'}°</div>
                 </div>

                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-[10px] font-mono text-[#fff] opacity-60">
                     <Sun size={12}/> TRUE LUX
                   </div>
                   <div className="font-mono text-sm text-[#00d9ff]">{telemetry.lux != null ? `${telemetry.lux} lx` : 'N/A'}</div>
                 </div>

                 <button 
                   onClick={() => setShowCamera(true)}
                   className="mt-2 w-full bg-[#ff2a2a] text-black font-mono text-[10px] py-1 hover:bg-[#fff] transition-colors"
                 >
                   OPEN CAMERA STREAM
                 </button>
               </div>
            </motion.div>

            {/* Chat History Box */}
            <motion.div 
              className="pointer-events-auto hud-panel hud-panel-skew-right w-[340px] h-[320px] flex flex-col gap-2"
              initial="hidden"
              animate="visible"
              variants={sidePanelVariants}
            >
              <Crosshair className="crosshair-corner cap-tl" size={12} />
              <Crosshair className="crosshair-corner cap-tr" size={12} />
              <Crosshair className="crosshair-corner cap-bl" size={12} />
              <Crosshair className="crosshair-corner cap-br" size={12} />

              <div className="hud-title">
                <Activity size={16} color="#00d9ff" />
                <span className="uppercase">Comm Log</span>
              </div>
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4"
              >
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[9px] font-mono text-[#fff] opacity-50 uppercase">
                        {msg.role === 'user' ? <><User size={10}/> Operator</> : <><Bot size={10}/> Soltra</>}
                      </div>
                      <div className={`px-3 py-1 font-mono text-[11px] leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-[rgba(0,217,255,0.1)] text-[#00d9ff] border-r-2 border-[#00d9ff]' 
                          : 'bg-[rgba(255,42,42,0.1)] text-[#ff2a2a] border-l-2 border-[#ff2a2a]'
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isProcessing && (
                  <div className="text-[#00d9ff] font-mono text-[10px] animate-pulse">
                    &gt; RECEIVING DATA...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom-center: Terminal Input */}
        <motion.div 
          className="pointer-events-auto flex flex-col items-center w-full"
          initial="hidden"
          animate="visible"
          variants={inputVariants}
        >
          {/* Command Suggestions */}
          <div className="flex gap-2 mb-2">
            {['STATUS', 'POSITION', 'WEATHER', 'SHADERS'].map(cmd => (
              <button 
                key={cmd}
                onClick={() => setChatInput(cmd)}
                className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[9px] font-mono text-white px-3 py-1 hover:border-[#00d9ff] transition-all"
              >
                {cmd}
              </button>
            ))}
          </div>

          <div className="hud-panel w-full max-w-3xl flex items-stretch p-0 overflow-hidden" style={{ borderLeftWidth: '1px' }}>
            <div className="bg-[rgba(0,217,255,0.1)] px-4 py-2 flex items-center justify-center border-r border-[rgba(0,217,255,0.4)]">
              <Cpu size={20} color="#00d9ff" />
            </div>
            
            <div className="flex-1 flex items-center px-4 gap-2">
              <span className="text-[#00d9ff] font-mono font-bold">&gt;</span>
              <input
                id="soltra-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                disabled={isProcessing}
                placeholder={isProcessing ? "TRANSMITTING..." : "AWAITING COMMAND..."}
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm"
                autoFocus
              />
            </div>

            <button
              id="soltra-send-btn"
              onClick={handleSendMessage}
              disabled={isProcessing}
              className={`hud-btn-send ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? "WAIT" : "EXECUTE"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Camera Stream Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-10"
            onClick={() => setShowCamera(false)}
          >
            <div 
              className="relative w-full max-w-4xl aspect-video bg-black border-2 border-[#ff2a2a] shadow-[0_0_50px_rgba(255,42,42,0.3)] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
               {/* Scanlines */}
               <div className="scanline-overlay" />
               
               {/* Header */}
               <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black to-transparent flex justify-between items-center">
                  <div className="text-[#ff2a2a] font-mono text-xl flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#ff2a2a] rounded-full animate-pulse" />
                    LIVE S3 FEED: CAM_01
                  </div>
                  <button onClick={() => setShowCamera(false)} className="text-white hover:text-[#ff2a2a]">
                    <X size={24} />
                  </button>
               </div>

               {/* Live Camera Stream */}
               {import.meta.env.VITE_CAMERA_STREAM_URL ? (
                 <img 
                   src={import.meta.env.VITE_CAMERA_STREAM_URL} 
                   alt="Live camera feed" 
                   className="absolute inset-0 w-full h-full object-cover" 
                 />
               ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 gap-3">
                   <div className="w-16 h-16 rounded-full border border-zinc-700 flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-600">
                       <path d="m15 8-8.5 8.5M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>
                       <path d="M21 3 9 15"/>
                     </svg>
                   </div>
                   <div className="text-center">
                     <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Camera Offline</p>
                     <p className="text-zinc-700 font-mono text-[10px] mt-1">VITE_CAMERA_STREAM_URL not configured</p>
                   </div>
                 </div>
               )}

               {/* Simulated scanline overlay */}
               <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)' }} />

               {/* HUD Overlay - live coords when available */}
               <div className="absolute bottom-4 left-4 font-mono text-[10px] text-[#00d9ff] flex flex-col">
                  <span>LAT: {telemetry?.lat != null ? `${telemetry.lat.toFixed(4)}° N` : '—'}</span>
                  <span>LNG: {telemetry?.lng != null ? `${telemetry.lng.toFixed(4)}° W` : '—'}</span>
                  <span>ELV: {telemetry?.elevation != null ? `${telemetry.elevation}m` : '—'}</span>
               </div>
               <div className="absolute bottom-4 right-4 font-mono text-[10px] text-[#00d9ff] text-right">
                  <span>BITRATE: 4.2 MB/S</span>
                  <span>FPS: 30.0</span>
                  <span>TS: {new Date().toISOString()}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
