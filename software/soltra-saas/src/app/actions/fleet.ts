'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSite(siteId: string) {
  const supabase = await createClient()

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
