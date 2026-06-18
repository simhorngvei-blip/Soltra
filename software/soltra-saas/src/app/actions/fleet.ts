'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSite(siteId: string) {
  const supabase = await createClient()

  // 1. Get all nodes for the site
  const { data: nodes } = await supabase.from('nodes').select('id').eq('site_id', siteId)
  
  if (nodes && nodes.length > 0) {
    const nodeIds = nodes.map(n => n.id)
    
    // 2. Delete telemetry for these nodes (assuming table name is 'telemetry')
    await supabase.from('telemetry').delete().in('node_id', nodeIds)
    
    // 3. Delete the nodes
    await supabase.from('nodes').delete().eq('site_id', siteId)
  }

  // 4. Delete the site
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId)

  if (error) {
    console.error('Failed to delete site:', error)
    return { success: false, error: error.message }
  }

  // Revalidate the fleet dashboard to update the UI
  revalidatePath('/dashboard/fleet')
  
  return { success: true }
}
