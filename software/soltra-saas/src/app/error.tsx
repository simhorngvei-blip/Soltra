'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn) {
      console.info(`[Sentry configured] Sending fault data to ${sentryDsn}`);
      // e.g. Sentry.captureException(error);
    }
    console.error('Unhandled fault captured by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <div className="text-[10px] font-mono tracking-[0.4em] text-zinc-700 uppercase mb-6">
          SOLTRA Protocol v.1.0.0 // System Fault
        </div>

        <div
          className="font-sans text-[10vw] leading-none text-red-500/80 uppercase italic select-none"
          style={{ letterSpacing: '-0.04em' }}
        >
          ERR
        </div>

        <div className="mt-4 inline-flex items-center gap-3 border border-red-900/40 bg-red-950/20 px-5 py-2 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
            UNEXPECTED_FAULT
          </span>
        </div>

        {error.message && (
          <div className="mt-6 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-left">
            <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Error Detail</p>
            <p className="text-sm font-mono text-zinc-400">{error.message}</p>
            {error.digest && (
              <p className="text-[10px] font-mono text-zinc-700 mt-1">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 hover:bg-emerald-900/50 px-5 py-2.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-all"
          >
            ↺ Retry
          </button>
          <a
            href="/"
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-mono text-zinc-300 hover:text-white transition-all"
          >
            ← Home
          </a>
        </div>
      </div>
    </div>
  )
}
