'use client'

import { useRef } from 'react'
import { Cpu, Activity, Database, Globe, Shield } from 'lucide-react'
import RadialOrbitalTimeline, { TimelineItem } from '@/components/ui/radial-orbital-timeline'
import Image from 'next/image'

const architectureData: TimelineItem[] = [
  {
    id: 1,
    title: "TRACKING HUB ORCHESTRATION",
    date: "CORE",
    content: "Distributed edge intelligence and sub-millisecond motor control resolution for the Master Hub.",
    category: "Processing",
    icon: Cpu,
    relatedIds: [2, 4],
    status: "completed",
    energy: 42,
  },
  {
    id: 2,
    title: "PREDICTIVE SENSORY",
    date: "SENSORY",
    content: "Geospatial weather processing and sun-path tracking for optimal, real-time panel alignment.",
    category: "AI Sense",
    icon: Activity,
    relatedIds: [1, 3],
    status: "in-progress",
    energy: 68,
  },
  {
    id: 3,
    title: "FLEET TELEMETRY",
    date: "STATE",
    content: "Real-time sync and persistent state architecture across the Supabase data layer for all solar nodes.",
    category: "Database",
    icon: Database,
    relatedIds: [1, 2, 4],
    status: "completed",
    energy: 25,
  },
  {
    id: 4,
    title: "HARDWARE MESH NETWORK",
    date: "NETWORK",
    content: "Serverless telemetry and seamless ESP32 node-to-node replication across the deployment area.",
    category: "Connectivity",
    icon: Globe,
    relatedIds: [1, 3, 5],
    status: "completed",
    energy: 55,
  },
  {
    id: 5,
    title: "ZERO-TRUST UPLINK",
    date: "SECURITY",
    content: "Robust TLS and cryptographic identity verification for all IoT edge nodes connecting to the dashboard.",
    category: "Security",
    icon: Shield,
    relatedIds: [1, 4],
    status: "completed",
    energy: 12,
  },
];

export function SpecGrid() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={containerRef} className="py-24 px-6 bg-black relative overflow-hidden min-h-screen flex flex-col justify-center">
      {/* Generated Ambient Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <Image 
          src="/images/soltra_spec_bg.png" 
          alt="Tech background" 
          fill 
          className="object-cover object-center mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black" />
      </div>

      <div className="max-w-[1400px] mx-auto w-full relative z-10 flex flex-col items-center">
        <h2 className="text-[8vw] text-impact mb-8 tracking-tighter italic text-center w-full">
          THE <span className="text-zinc-800">ARCHITECTURE</span>
        </h2>
        
        <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mb-12 text-center max-w-2xl">
          Interactive node topology. Select any system component to view status, energy levels, and active connections.
        </p>

        <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl shadow-primary/10">
          <RadialOrbitalTimeline timelineData={architectureData} />
        </div>
      </div>
    </section>
  )
}
