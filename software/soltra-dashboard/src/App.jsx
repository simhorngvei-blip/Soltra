import { Suspense, useState, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import './App.css';
import DigitalTwinEnv from './components/DigitalTwinEnv';
import VrmAvatar from './components/VrmAvatar';
import CubeLoader from './components/ui/cube-loader';

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

function CustomLoader() {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
      <CubeLoader />
    </div>
  );
}

/* ─── Main App ─────────────────────────────────────────────────────── */
export default function App() {
  const [currentAnimation] = useState('idle');
  const [currentExpression] = useState('neutral');
  const [shaderMode] = useState('toon');
  const [isTalking] = useState(false);
  const [audioAnalyser] = useState(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Global CRT Scanline Overlay */}
      <div className="scanline-overlay" />

      {/* ── 3D Canvas ── */}
      <CanvasErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [0, 0.8, 5], fov: 50 }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
          gl={{ antialias: true, alpha: true }}
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

      <CustomLoader />
    </div>
  );
}
