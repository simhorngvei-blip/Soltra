import { TerminalHero } from '@/components/landing/TerminalHero'
import { SpecGrid } from '@/components/landing/SpecGrid'
import { PurchaseCard } from '@/components/landing/PurchaseCard'
import { SplineShowcase } from '@/components/sections/SplineShowcase'
import { AnimatedNav } from '@/components/ui/animated-nav'

export default function Home() {
  return (
    <main className="relative flex flex-col min-h-screen bg-black overflow-x-hidden">
      {/* Minimal Nav - Industrial Glass */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-12 py-6 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5 transition-all duration-500">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white flex items-center justify-center font-sans text-black text-2xl italic font-bold">S</div>
            <span className="text-3xl font-sans tracking-tighter text-white italic uppercase">SOLTRA</span>
          </div>
          
          <div className="hidden md:flex">
            <AnimatedNav />
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 text-[10px] font-mono tracking-[0.4em] uppercase text-zinc-500">
          <a href="/login" className="hover:text-primary transition-colors border border-white/20 px-4 py-2 text-zinc-400 hover:border-primary/50 transition-all">Sign In</a>
          <a href="/login?tab=signup" className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-4 py-2 font-sans text-sm tracking-wide">Get Started</a>
        </div>
      </nav>

      <div className="pt-32">
        <TerminalHero />
      </div>

      <div className="py-20" id="avatar-core">
        <SplineShowcase />
      </div>
      
      <div id="specs">
        <SpecGrid />
      </div>

      <div id="purchase">
        <PurchaseCard />
      </div>

      <footer className="py-24 px-12 bg-black border-t border-zinc-900">
        <div className="max-w-[1400px] mx-auto grid md:grid-cols-2 gap-24">
          <div>
            <h2 className="text-[6vw] text-impact mb-8 italic">SOLTRA<span className="text-primary">.GRID</span></h2>
            <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest leading-relaxed max-w-sm">
              The next generation of cognitive energy infrastructure. 
              Built for the transition to a decentralized, 
              resilient planetary grid.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <div className="text-zinc-800 font-mono text-[10px] tracking-[0.3em] uppercase mb-6">Contact</div>
              <ul className="space-y-2 text-zinc-400 font-mono text-xs uppercase tracking-widest">
                <li><a href="mailto:support@soltra.solar" className="hover:text-primary transition-colors">Support</a></li>
                <li><a href="mailto:sales@soltra.solar" className="hover:text-primary transition-colors">Sales</a></li>
                <li><a href="mailto:press@soltra.solar" className="hover:text-primary transition-colors">Press</a></li>
              </ul>
            </div>
            <div>
              <div className="text-zinc-800 font-mono text-[10px] tracking-[0.3em] uppercase mb-6">Legal</div>
              <ul className="space-y-2 text-zinc-400 font-mono text-xs uppercase tracking-widest">
                <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">Terms</a></li>
                <li><a href="/privacy#cookies" className="hover:text-primary transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto mt-24 pt-8 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono text-zinc-800 uppercase tracking-widest">
          <span>© 2026 SOLTRA Solar</span>
          <span>SOLTRA Protocol v.1.0.0</span>
        </div>
      </footer>
    </main>
  )
}
