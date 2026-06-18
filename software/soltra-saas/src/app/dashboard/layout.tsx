import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions/auth'
import type { SoltraUser } from '@/lib/types'

// ─── Dashboard Layout ─────────────────────────────────────────────────────────
// Wraps all /dashboard/* pages with the sidebar.
// Exceptions (rendered without sidebar via their own layout):
//   /dashboard/onboarding   — full-screen wizard
//   /dashboard/reset-password — full-screen password form
// These exceptions return early before mounting the sidebar.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch profile for sidebar display
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const p = profile as SoltraUser | null
  const isFleetAdmin = p?.role === 'fleet_admin'
  const hudUrl = process.env.NEXT_PUBLIC_HUD_URL || 'http://localhost:5173'
  const overseerUrl = process.env.NEXT_PUBLIC_OVERSEER_URL || 'http://localhost:5174'

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col px-4 py-6 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs tracking-widest text-zinc-400 uppercase">SOLTRA</span>
          {p?.subscription_tier && p.subscription_tier !== 'free' && (
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-800/50 uppercase">
              {p.subscription_tier}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 text-sm">
          <a
            href="/dashboard/homeowner"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <span>🏠</span> Home Dashboard
          </a>
          {isFleetAdmin && (
            <a
              href="/dashboard/fleet"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <span>⚡</span> Fleet Command
            </a>
          )}
          <a
            href={overseerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 hover:border-emerald-950 transition-colors"
          >
            <span>🤖</span> AI Overseer
          </a>
          <a
            href={hudUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 hover:border-red-950 transition-colors"
          >
            <span>🔺</span> System HUD
          </a>
          <div className="h-px bg-zinc-800/50 my-2" />
          <a
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-xs"
          >
            <span>⚙️</span> Settings
          </a>
          <a
            href="/dashboard/onboarding"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-xs"
          >
            <span>️＋</span> Add Site / Node
          </a>
        </nav>

        {/* User info + Sign out */}
        <div className="mt-auto space-y-3">
          <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-2.5">
            <p className="text-xs text-zinc-300 truncate">{p?.email ?? user.email}</p>
            <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">
              {p?.role === 'fleet_admin' ? '⚡ Fleet Admin' : '🏠 Homeowner'}
              {' · '}
              {p?.subscription_tier ?? 'free'}
            </p>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Sign Out
            </button>
          </form>

          <div className="text-[10px] text-zinc-600 font-mono px-1">
            v1.0.0 // SOLTRA
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
