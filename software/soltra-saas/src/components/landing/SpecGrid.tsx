'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Cpu, Radio, Zap, Terminal, Activity, Globe, Shield, Database } from 'lucide-react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

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
    <section ref={containerRef} className="py-32 px-6 bg-black relative">
      <div className="max-w-[1400px] mx-auto">
        <h2 className="text-[8vw] text-impact mb-24 tracking-tighter italic">
          THE <span className="text-zinc-800">ARCHITECTURE</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-[250px] gap-6">
          {/* Card 1: Master Hub */}
          <div className="bento-item md:col-span-8 md:row-span-2 bento-card bg-primary text-black border-none group">
            <Cpu size={64} className="mb-8 group-hover:scale-110 transition-transform" />
            <div className="max-w-md">
              <h3 className="text-6xl font-sans leading-none mb-4 italic">MASTER HUB</h3>
              <p className="font-mono text-sm uppercase tracking-tight opacity-70">
                Heltec WiFi LoRa 32 V3 (ESP32-S3) / Dual-Core FreeRTOS / Mission-Critical Logic Controller.
              </p>
            </div>
          </div>

          {/* Card 2: AI Sense */}
          <div className="bento-item md:col-span-4 md:row-span-1 bento-card bg-zinc-900 group">
            <Activity className="text-primary mb-4" />
            <h3 className="text-2xl font-sans text-white">AI SENSE</h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Computer Vision / CNN Sun Tracking</p>
          </div>

          {/* Card 3: Database */}
          <div className="bento-item md:col-span-4 md:row-span-1 bento-card border-primary/20 bg-background group">
            <Database className="text-primary mb-4" />
            <h3 className="text-2xl font-sans text-white">SUPABASE</h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Real-time DB / Auth / Storage</p>
          </div>

          {/* Card 4: Connectivity */}
          <div className="bento-item md:col-span-4 md:row-span-2 bento-card bg-zinc-100 text-black border-none">
            <Globe size={48} className="mb-auto" />
            <div>
              <h3 className="text-4xl font-sans leading-none mb-2 italic uppercase">GLOBAL MESH</h3>
              <p className="font-mono text-xs uppercase tracking-tight text-zinc-500">
                HiveMQ Serverless / MQTT over TLS / Distributed Telemetry.
              </p>
            </div>
          </div>

          {/* Card 5: Security */}
          <div className="bento-item md:col-span-8 md:row-span-1 bento-card bg-zinc-900 flex-row items-center gap-12">
            <Shield size={64} className="text-primary shrink-0" />
            <div>
              <h3 className="text-4xl font-sans text-white italic uppercase">ENCRYPTED UPLINK</h3>
              <p className="font-mono text-xs text-zinc-500 uppercase">End-to-end TLS / RLS Security / Zero-Trust Access.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
