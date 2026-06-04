import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Node, Site } from '@/lib/types'
import { HomeownerClient } from '@/components/dashboard/homeowner-client'

export const metadata: Metadata = {
  title: 'My Solar Array',
}

// ─── No-node state ─────────────────────────────────────────────────────────────
function NoNodeState({ siteName }: { siteName: string }) {
  return (
    <div className="p-6 max-w-xl mx-auto mt-20 text-center">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 space-y-4">
        <div className="text-4xl">⚡</div>
        <h2 className="text-lg font-semibold text-zinc-200">No nodes registered</h2>
        <p className="text-sm text-zinc-500 font-mono">
          Site <span className="text-zinc-300">{siteName}</span> has no SOLTRA nodes yet.
        </p>
        <a
          href="/dashboard/onboarding"
          className="inline-block mt-4 rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-xs font-mono text-emerald-400 hover:bg-emerald-900/50 transition-colors"
        >
          Register a Node →
        </a>
      </div>
    </div>
  )
}

// ─── Server Component — fetches real node from DB ─────────────────────────────
export default async function HomeownerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user's sites with their nodes in a single query
  const { data: sites } = await supabase
    .from('sites')
    .select('*, nodes(*)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  // New user with no sites → send to onboarding
  if (!sites || sites.length === 0) {
    redirect('/dashboard/onboarding')
  }

  const site = sites[0] as Site & { nodes: Node[] }
  const nodes = site.nodes ?? []

  // Has site but no nodes → show call-to-action
  if (nodes.length === 0) {
    return <NoNodeState siteName={site.name} />
  }

  // Pass the first node to the client component
  const primaryNode = nodes[0]

  return (
    <HomeownerClient
      nodeId={primaryNode.id}
      nodeMac={primaryNode.mac_address}
      nodeLabel={primaryNode.label ?? primaryNode.mac_address}
      siteName={site.name}
      siteTimezone={site.timezone}
    />
  )
}
