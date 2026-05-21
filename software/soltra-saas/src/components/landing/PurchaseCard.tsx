'use client'

import { useState, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, ShieldCheck, Sparkles, Zap, Loader2, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const TIERS = [
  {
    id: 'standard',
    name: 'Residential',
    price: '299',
    desc: 'Backyard optimization.',
    accent: 'zinc-900',
    text: 'white'
  },
  {
    id: 'advanced',
    name: 'Professional',
    price: '799',
    desc: 'High-yield deployment.',
    accent: 'primary',
    text: 'black'
  },
  {
    id: 'enterprise',
    name: 'Industrial',
    price: 'CUSTOM',
    desc: 'Scalable fleet control.',
    accent: 'zinc-100',
    text: 'black'
  }
]

export function PurchaseCard() {
  const router = useRouter()
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.pricing-card', {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
      },
      y: 50,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'power3.out'
    })
  }, { scope: containerRef })

  const handlePurchase = async (tier: string) => {
    if (tier === 'enterprise') {
      window.location.href = 'mailto:sales@soltra.solar'
      return
    }

    setLoadingTier(tier)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      })

      const data = await res.json()
      
      if (res.status === 401) {
        router.push(`/login?redirect=/#purchase`)
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Purchase error:', err)
      alert('System connection error. The secure payment gateway is currently undergoing maintenance. Please try again later or contact sales@soltra.solar.')
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <section ref={containerRef} className="py-32 px-6 bg-black">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-12">
          <h2 className="text-[10vw] text-impact tracking-tighter leading-[0.8] italic uppercase">
            SELECT <br /> <span className="text-primary">YOUR TIER</span>
          </h2>
          <p className="max-w-sm text-zinc-600 font-mono text-sm uppercase tracking-widest leading-relaxed">
            Deployment units for residential, professional, and industrial grade solar tracking arrays.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((tier, i) => (
            <div
              key={i}
              className={`
                pricing-card p-12 min-h-[500px] flex flex-col justify-between industrial-border border-none
                ${tier.accent === 'primary' ? 'bg-primary' : tier.accent === 'zinc-100' ? 'bg-zinc-100' : 'bg-zinc-900'}
              `}
            >
              <div className={tier.text === 'black' ? 'text-black' : 'text-white'}>
                <div className="text-[10px] font-mono uppercase tracking-[0.4em] mb-4 opacity-50">
                  Tier // 0{i + 1}
                </div>
                <h3 className="text-6xl font-sans italic leading-[0.9] uppercase mb-2">{tier.name}</h3>
                <p className="font-mono text-xs uppercase tracking-widest opacity-60">{tier.desc}</p>
              </div>

              <div className={tier.text === 'black' ? 'text-black' : 'text-white'}>
                <div className="flex items-start mb-8">
                  {tier.price !== 'CUSTOM' && <span className="text-2xl font-sans mt-2 italic">$</span>}
                  <span className="text-8xl font-sans italic leading-none tracking-tighter">{tier.price}</span>
                </div>

                <button 
                  onClick={() => handlePurchase(tier.id)}
                  disabled={loadingTier !== null}
                  className={`
                    group w-full py-6 flex items-center justify-between border-t transition-all hover:bg-black/5
                    ${tier.text === 'black' ? 'border-black/20 text-black' : 'border-white/20 text-white'}
                  `}
                >
                  <span className="text-3xl font-sans italic uppercase">
                    {loadingTier === tier.id ? 'PENDING...' : 'DEPLOY'}
                  </span>
                  <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
