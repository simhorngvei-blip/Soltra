'use client'

import dynamic from 'next/dynamic';
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"

const VRMScene = dynamic(() => import("@/components/ui/vrm-scene").then(mod => mod.VRMScene), { 
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-zinc-500 uppercase tracking-widest animate-pulse">Initializing Avatar Core...</div>
});

export function SplineShowcase() {
  return (
    <section className="py-24 px-6 bg-black">
      <div className="max-w-[1400px] mx-auto">
        <Card className="w-full h-[600px] bg-zinc-900/50 border-zinc-800 relative overflow-hidden industrial-border border-none">
          <Spotlight
            className="-top-40 left-0 md:left-60 md:-top-20"
            fill="white"
          />
          
          <div className="flex flex-col md:flex-row h-full">
            {/* Left content */}
            <div className="flex-1 p-12 relative z-10 flex flex-col justify-center">
              <h2 className="text-6xl md:text-8xl font-sans text-impact italic leading-[0.85] text-white mb-6 uppercase">
                AVATAR <br /> <span className="text-primary">CORE ENGINE</span>
              </h2>
              <p className="mt-4 text-zinc-400 font-mono text-sm uppercase tracking-widest max-w-lg leading-relaxed">
                Experience the weightless precision of Project SOLTRA through our
                high-fidelity spatial avatar. Real-time humanoid interaction.
              </p>
              
              <div className="mt-12 flex gap-8 items-center font-mono text-[10px] text-zinc-600 uppercase tracking-[0.3em]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  VRM Native
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Idle State
                </div>
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 relative min-h-[400px]">
              <VRMScene url="/Girl_alt.vrm" animUrl="/idle.glb" />
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
