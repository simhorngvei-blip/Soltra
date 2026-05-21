'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Zap, ArrowRight, ArrowDown } from 'lucide-react'

export function TerminalHero() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    
    tl.from('.hero-word', {
      yPercent: 100,
      opacity: 0,
      duration: 1.5,
      stagger: 0.1,
    })
    .from('.hero-cta-box', {
      scale: 0.9,
      opacity: 0,
      duration: 1,
    }, '-=1')
    .from('.hero-stat-item', {
      y: 20,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1
    }, '-=0.5')
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="relative min-h-screen flex flex-col justify-center px-12 pt-24 bg-black overflow-hidden">
      <div className="max-w-[1400px] mx-auto w-full">
        {/* Top Header Label */}
        <div className="flex justify-between items-end mb-12">
          <div className="text-[10px] font-mono tracking-[0.4em] uppercase text-zinc-600">
            Helios System / Project_Soltra
          </div>
          <div className="flex gap-4">
            {['EN', 'FR'].map(lang => (
              <span key={lang} className="text-[10px] font-mono text-zinc-800 hover:text-white cursor-pointer transition-colors">
                {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Huge Impact Title */}
        <h1 className="text-[clamp(4rem,12vw,14rem)] text-impact leading-[0.8] mb-16 tracking-[-0.05em]">
          <div className="overflow-hidden">
            <span className="hero-word inline-block">AUTONOMOUS</span>
          </div>
          <div className="overflow-hidden text-primary italic">
            <span className="hero-word inline-block">SOLAR</span>
          </div>
          <div className="overflow-hidden">
            <span className="hero-word inline-block">REVOLUTION</span>
          </div>
        </h1>

        <div className="grid lg:grid-cols-12 gap-12 items-end">
          {/* Summary / Description */}
          <div className="lg:col-span-5">
            <p className="text-xl md:text-2xl font-mono text-zinc-500 leading-tight uppercase mb-8">
              Revolutionizing solar energy through precision 
              edge-computing and distributed telemetry.
            </p>
            <div className="flex gap-12">
              <div className="hero-stat-item">
                <div className="text-3xl font-sans text-white leading-none">99.8%</div>
                <div className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest mt-1">Uptime</div>
              </div>
              <div className="hero-stat-item">
                <div className="text-3xl font-sans text-white leading-none">42MS</div>
                <div className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest mt-1">Latency</div>
              </div>
            </div>
          </div>

          {/* CTA Box - High Contrast Brutalist */}
          <div className="lg:col-span-7">
            <div className="hero-cta-box bg-primary p-12 flex flex-col justify-between min-h-[300px] industrial-border border-none">
              <div className="flex justify-between items-start">
                <div className="text-4xl font-sans text-black italic leading-[0.9]">
                  JOIN THE <br /> FUTURE GRID.
                </div>
                <Zap size={48} className="text-black" fill="currentColor" />
              </div>
              
              <div className="flex justify-between items-end">
                <button className="flex items-center gap-4 text-black font-sans text-4xl hover:translate-x-4 transition-transform group italic">
                  START DEPLOYMENT <ArrowRight size={40} />
                </button>
                <div className="text-[10px] font-mono text-black/50 uppercase tracking-widest">
                  Available v.0.9.4
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Scroll Indicator */}
      <div className="absolute bottom-12 left-12 flex items-center gap-4 text-zinc-800 font-mono text-[10px] tracking-widest uppercase">
        <ArrowDown size={14} /> Scroll to Explore
      </div>
    </section>
  )
}
