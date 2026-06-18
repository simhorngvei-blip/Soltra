'use client'

import React, { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF } from '@react-three/drei';

function GLBModel({ url }: { url: string }) {
  // useGLTF automatically loads all original colors, materials, and geometry!
  const { scene } = useGLTF(url);

  return <primitive object={scene} castShadow receiveShadow />;
}

export function PrototypeShowcase() {
  return (
    <section className="relative w-full h-[800px] bg-[#0a0a0a] text-[#e0e0e0] font-sans overflow-hidden flex items-center justify-center border-y border-zinc-900">
      
      {/* SVG Filter for Grain */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <div 
        className="absolute inset-0 pointer-events-none z-[100] opacity-15" 
        style={{ filter: 'url(#grain)' }}
      />

      {/* Interface Overlay */}
      <div className="absolute inset-0 p-8 md:p-12 grid grid-cols-2 grid-rows-[auto_1fr_auto] z-10 pointer-events-none">
        
        <div className="font-bold tracking-widest text-sm text-white/80">
          PROTOTYPE_ARCHIVE
        </div>
        
        <div className="text-right font-mono text-primary text-xs uppercase tracking-widest leading-relaxed">
          <div>MODEL: FINAL_DESIGNS.GLB</div>
          <div>RENDER: ACTIVE</div>
        </div>

        <h2 className="col-span-2 self-center text-[clamp(3rem,8vw,8rem)] leading-[0.85] tracking-tight font-sans italic text-white pointer-events-none uppercase drop-shadow-2xl">
          HARDWARE <br /> 
          <span className="text-primary">TOPOLOGY</span>
        </h2>

        <div className="col-span-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            <p className="text-zinc-400">[ ARCHIVE 2026 ]</p>
            <p>INTERACTIVE 3D CAD MODEL</p>
          </div>
          
          <button className="pointer-events-auto bg-white text-black px-8 py-4 font-sans font-bold italic text-xl flex items-center gap-4 transition-all hover:bg-primary hover:-translate-y-1 group border-none">
            VIEW SCHEMATICS <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 0, 150], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[20, 20, 20]} intensity={1.5} castShadow />
          <pointLight position={[-20, -20, -20]} intensity={1.0} color="#ff3c00" />
          
          <Suspense fallback={null}>
            <Center scale={0.35}>
              <GLBModel url="/Final designs.glb" />
            </Center>
          </Suspense>
          
          <OrbitControls 
            autoRotate 
            autoRotateSpeed={1.5} 
            enableZoom={false} 
            makeDefault 
          />
        </Canvas>
      </div>
    </section>
  );
}
