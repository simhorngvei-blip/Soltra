'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Server, Globe, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as PricingCard from '@/components/ui/pricing-card'

const TIERS = [
  {
    id: 'standard',
    name: 'Single Node',
    price: '1,499',
    period: '/kit',
    desc: 'Hardware Dev Kit & Prototyping License.',
    icon: <Cpu />,
    features: [
      '1x ESP32 AI Tracking Kit',
      '1Hz Telemetry Sync',
      'Community Forum Support',
      'Standard REST API Access',
    ],
    accent: 'zinc-900',
    text: 'white',
    variant: 'outline'
  },
  {
    id: 'advanced',
    name: 'Commercial Array',
    price: '4,999',
    period: '/year',
    desc: 'Fleet-wide telemetry & optimal yield orchestration.',
    icon: <Server />,
    badge: 'Popular',
    features: [
      'Up to 50 Hardware Nodes',
      'Sub-second Real-Time Telemetry',
      'Predictive Weather Alerts',
      'Advanced Webhook Integration',
      'Priority SLA Support',
    ],
    accent: 'primary',
    text: 'black',
    variant: 'default'
  },
  {
    id: 'enterprise',
    name: 'Utility Scale',
    price: 'CUSTOM',
    period: '/deployment',
    desc: 'Grid-scale orchestration & custom architectures.',
    icon: <Globe />,
    features: [
      'Unlimited Node Orchestration',
      'Multi-site Mesh Networking',
      'Custom Sun-path Neural Models',
      'On-Premises Server Deployment',
      '24/7 Dedicated Engineering Team',
    ],
    accent: 'zinc-100',
    text: 'black',
    variant: 'outline'
  }
]

export function PurchaseCard() {
  const router = useRouter()
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePurchase = async (tier: string) => {
    if (tier === 'enterprise') {
      window.location.assign('mailto:sales@soltra.solar')
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
        window.location.assign(data.url)
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
          <h2 className="text-[10vw] text-impact tracking-tighter leading-[0.8] italic uppercase text-white">
            SELECT <br /> <span className="text-primary">YOUR TIER</span>
          </h2>
          <p className="max-w-sm text-zinc-600 font-mono text-sm uppercase tracking-widest leading-relaxed">
            Licensing tiers for cognitive node intelligence and planetary mesh telemetry.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <PricingCard.Card 
              key={tier.id} 
              className={`md:min-w-[260px] h-full ${tier.accent === 'primary' ? 'border-primary' : 'border-zinc-800'} bg-black text-white`}
            >
              <PricingCard.Header>
                <PricingCard.Plan>
                  <PricingCard.PlanName>
                    <div className="text-white">
                      {tier.icon}
                    </div>
                    <span className="text-zinc-400 font-mono tracking-widest uppercase">{tier.name}</span>
                  </PricingCard.PlanName>
                  {tier.badge && (
                    <PricingCard.Badge className="bg-primary text-black">{tier.badge}</PricingCard.Badge>
                  )}
                </PricingCard.Plan>
                <PricingCard.Price>
                  {tier.price !== 'CUSTOM' && <span className="text-xl font-sans mt-2 italic mr-1 text-white">RM</span>}
                  <PricingCard.MainPrice className="text-white">{tier.price}</PricingCard.MainPrice>
                  {tier.period && <PricingCard.Period className="text-zinc-500">{tier.period}</PricingCard.Period>}
                </PricingCard.Price>
                
                <Button
                  variant={tier.variant as any}
                  className={`w-full font-mono uppercase tracking-widest mt-4 ${
                    tier.variant === 'default' 
                      ? 'bg-primary text-black hover:bg-primary/90' 
                      : 'border-zinc-800 text-white hover:bg-zinc-900 hover:text-white'
                  }`}
                  onClick={() => handlePurchase(tier.id)}
                  disabled={loadingTier !== null}
                >
                  {loadingTier === tier.id ? 'PENDING...' : tier.price === 'CUSTOM' ? 'CONTACT SALES' : 'DEPLOY NOW'}
                </Button>
              </PricingCard.Header>

              <PricingCard.Body>
                <PricingCard.Description className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
                  {tier.desc}
                </PricingCard.Description>
                <PricingCard.List>
                  {tier.features.map((item) => (
                    <PricingCard.ListItem key={item} className="text-zinc-300">
                      <CheckCircle2
                        className="text-primary h-4 w-4"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xs uppercase">{item}</span>
                    </PricingCard.ListItem>
                  ))}
                </PricingCard.List>
              </PricingCard.Body>
            </PricingCard.Card>
          ))}
        </div>
      </div>
    </section>
  )
}
