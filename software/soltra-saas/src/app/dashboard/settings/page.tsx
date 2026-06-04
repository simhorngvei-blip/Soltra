import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/dashboard/settings-client'
import type { SoltraUser, Site, Node } from '@/lib/types'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, sitesResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('sites').select('*, nodes(*)').eq('owner_id', user.id).order('created_at', { ascending: true }),
  ])

  const profile = profileResult.data as SoltraUser | null
  const sites   = (sitesResult.data ?? []) as (Site & { nodes: Node[] })[]

  return <SettingsClient profile={profile} sites={sites} userId={user.id} />
}
