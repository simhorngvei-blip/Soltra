'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface CreateSiteInput {
  name:     string
  location: string
  timezone: string
}

export interface CreateNodeInput {
  siteId: string
  mac:    string
  label:  string
}

/**
 * Server action: Create a site for the authenticated user.
 * Called in step 1 of the onboarding wizard.
 */
export async function createSite(data: CreateSiteInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Validate name
  if (!data.name?.trim()) {
    throw new Error('Site name is required')
  }

  const { data: site, error } = await supabase
    .from('sites')
    .insert({
      owner_id: user.id,
      name:     data.name.trim(),
      lat:      null,
      lng:      null,
      timezone: data.timezone || 'UTC',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create site: ${error.message}`)
  return site as { id: string; name: string }
}

/**
 * Server action: Register a hardware node for a site.
 * Called in step 2 of the onboarding wizard.
 */
export async function createNode(data: CreateNodeInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Validate MAC address format
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
  if (!macRegex.test(data.mac)) {
    throw new Error('Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)')
  }

  // Verify user owns the site (security check)
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id')
    .eq('id', data.siteId)
    .eq('owner_id', user.id)
    .single()

  if (siteErr || !site) {
    throw new Error('Site not found or access denied')
  }

  // Check for duplicate MAC
  const { data: existing } = await supabase
    .from('nodes')
    .select('id')
    .eq('mac_address', data.mac.toUpperCase())
    .single()

  if (existing) {
    throw new Error('A node with this MAC address is already registered')
  }

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      site_id:     data.siteId,
      mac_address: data.mac.toUpperCase(),
      label:       data.label?.trim() || null,
      status:      'offline',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to register node: ${error.message}`)
  return node as { id: string; mac_address: string }
}
