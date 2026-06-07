'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Cpu, Radio, Zap, Terminal, Activity, Globe, Shield, Database } from 'lucide-react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HoverEffect } from '@/components/ui/hover-effect'
import Image from 'next/image'

gsap.registerPlugin(ScrollTrigger)

export function SpecGrid() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.bento-item', {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
      },
      scale: 0.9,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'power3.out'
    })
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="py-32 px-6 bg-black relative overflow-hidden">
      {/* Generated Ambient Background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <Image 
          src="/images/soltra_spec_bg.png" 
          alt="Tech background" 
          fill 
          className="object-cover object-center mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <h2 className="text-[8vw] text-impact mb-24 tracking-tighter italic">
          THE <span className="text-zinc-800">ARCHITECTURE</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-[250px] gap-6">
          {/* Card 1: Master Hub */}
          <HoverEffect className="md:col-span-8 md:row-span-2 p-0">
            <div className="bento-item h-full w-full bento-card bg-zinc-900 text-white border-none group relative overflow-hidden">
              <Image src="/images/master_hub_bg.png" alt="Master Hub" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <Cpu size={64} className="mb-8 text-primary group-hover:scale-110 transition-transform" />
                <div className="max-w-md">
                  <h3 className="text-6xl font-sans leading-none mb-4 italic">NEURAL ORCHESTRATION</h3>
                  <p className="font-mono text-sm uppercase tracking-tight text-zinc-300">
                    Distributed edge intelligence / Sub-millisecond state resolution.
                  </p>
                </div>
              </div>
            </div>
          </HoverEffect>

          {/* Card 2: AI Sense */}
          <HoverEffect className="md:col-span-4 md:row-span-1 p-0">
            <div className="bento-item h-full w-full bento-card bg-zinc-900 group relative overflow-hidden border-none">
              <Image src="/images/ai_sense_bg.png" alt="AI Sense" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20" />
              <div className="relative z-10 h-full flex flex-col justify-end">
                <Activity className="text-primary mb-4" />
                <h3 className="text-2xl font-sans text-white">COGNITIVE VISION</h3>
                <p className="text-[10px] font-mono text-zinc-400 uppercase">Predictive tracking / Geospatial neural processing</p>
              </div>
            </div>
          </HoverEffect>

          {/* Card 3: Database */}
          <HoverEffect className="md:col-span-4 md:row-span-1 p-0">
            <div className="bento-item h-full w-full bento-card bg-zinc-900 group relative overflow-hidden border-none">
              <Image src="/images/supabase_bg.png" alt="Supabase" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20" />
              <div className="relative z-10 h-full flex flex-col justify-end">
                <Database className="text-primary mb-4" />
                <h3 className="text-2xl font-sans text-white">GLOBAL SYNTHESIS</h3>
                <p className="text-[10px] font-mono text-zinc-400 uppercase">Real-time sync / Persistent state architecture</p>
              </div>
            </div>
          </HoverEffect>

          {/* Card 4: Connectivity */}
          <HoverEffect className="md:col-span-4 md:row-span-2 p-0">
            <div className="bento-item h-full w-full bento-card bg-zinc-900 text-white border-none relative overflow-hidden group">
              <Image src="/images/global_mesh_bg.png" alt="Global Mesh" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative z-10 h-full flex flex-col">
                <Globe size={48} className="mb-auto text-primary" />
                <div>
                  <h3 className="text-4xl font-sans leading-none mb-2 italic uppercase">PLANETARY MESH</h3>
                  <p className="font-mono text-xs uppercase tracking-tight text-zinc-300">
                    Serverless telemetry / Seamless node-to-node replication.
                  </p>
                </div>
              </div>
            </div>
          </HoverEffect>

          {/* Card 5: Security */}
          <HoverEffect className="md:col-span-8 md:row-span-1 p-0">
            <div className="bento-item h-full w-full bento-card bg-zinc-900 flex flex-row items-center gap-12 border-none relative overflow-hidden group">
              <Image src="/images/encrypted_uplink_bg.png" alt="Security" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-black/20" />
              <div className="relative z-10 flex items-center gap-12 w-full">
                <Shield size={64} className="text-primary shrink-0" />
                <div>
                  <h3 className="text-4xl font-sans text-white italic uppercase">ZERO-TRUST UPLINK</h3>
                  <p className="font-mono text-xs text-zinc-300 uppercase">Quantum-resistant TLS / Cryptographic identity verification.</p>
                </div>
              </div>
            </div>
          </HoverEffect>
        </div>
      </div>
    </section>
  )
}
