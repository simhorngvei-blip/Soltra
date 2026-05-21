import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication | SOLTRA',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md relative">
        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* SOLTRA wordmark */}
        <div className="mb-12 text-center relative z-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 bg-primary animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.4em] text-primary/60 uppercase">
              Terminal Access // Uplink
            </span>
          </div>
          <h1 className="text-5xl font-sans tracking-tight text-white uppercase italic">
            SOLTRA<span className="text-primary">.AUTH</span>
          </h1>
          <p className="mt-2 text-xs font-mono text-zinc-600 uppercase tracking-widest">
            Level 3 Security Protocol Active
          </p>
        </div>

        <div className="relative z-10">
          {children}
        </div>

        <div className="mt-12 text-center relative z-10">
          <p className="text-[8px] font-mono text-zinc-700 uppercase tracking-[0.5em]">
            © 2026 Helios Systems // All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  )
}
