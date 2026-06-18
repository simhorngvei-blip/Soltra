'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSite(siteId: string) {
  const supabase = await createClient()

  // 1. Get all nodes for the site
  const { data: nodes } = await supabase.from('nodes').select('id').eq('site_id', siteId)
  
  if (nodes && nodes.length > 0) {
    const nodeIds = nodes.map(n => n.id)
    
    // 2. Delete telemetry
    const { error: telError } = await supabase.from('telemetry').delete().in('node_id', nodeIds)
    if (telError) return { success: false, error: `Telemetry deletion failed: ${telError.message}` }

    // 3. Delete camera events
    const { error: camError } = await supabase.from('camera_events').delete().in('node_id', nodeIds)
    if (camError) return { success: false, error: `Camera events deletion failed: ${camError.message}` }
    
    // 4. Delete the nodes
    const { error: nodeError } = await supabase.from('nodes').delete().eq('site_id', siteId)
    if (nodeError) return { success: false, error: `Nodes deletion failed: ${nodeError.message}` }
  }

  // 5. Delete the site
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId)

  if (error) {
    console.error('Failed to delete site:', error)
    return { success: false, error: `Site deletion failed: ${error.message}` }
  }

  // Revalidate the fleet dashboard to update the UI
  revalidatePath('/dashboard/fleet')
  
  return { success: true }
}
