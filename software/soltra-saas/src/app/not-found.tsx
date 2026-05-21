import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '404 — Node Not Found | SOLTRA Solar',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        {/* Glitch decoration */}
        <div className="text-[10px] font-mono tracking-[0.4em] text-zinc-700 uppercase mb-6">
          SOLTRA Protocol v.1.0.0 // Error
        </div>

        {/* Giant 404 */}
        <div
          className="font-sans text-[14vw] leading-none text-white uppercase italic select-none"
          style={{ letterSpacing: '-0.04em' }}
        >
          404
        </div>

        {/* Status line */}
        <div className="mt-4 inline-flex items-center gap-3 border border-red-900/40 bg-red-950/20 px-5 py-2 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
            NODE_NOT_FOUND
          </span>
        </div>

        <p className="mt-6 text-sm text-zinc-500 font-mono">
          The requested resource does not exist or has been moved.
        </p>

        {/* Actions */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-mono text-zinc-300 hover:text-white transition-all"
          >
            ← Return to Base
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 hover:bg-emerald-900/50 px-5 py-2.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-all"
          >
            Sign In →
          </Link>
        </div>

        <div className="mt-16 text-[10px] font-mono text-zinc-800">
          © 2026 Helios Systems
        </div>
      </div>
    </div>
  )
}
