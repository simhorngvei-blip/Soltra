import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /auth/callback
 *
 * Supabase redirects here after:
 *   1. Email confirmation (type=undefined)
 *   2. Password reset magic link (type=recovery)
 *
 * Exchanges the auth code for a session, then routes the user to the
 * appropriate destination based on their role and the callback type.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const type      = searchParams.get('type')       // 'recovery' for password reset
  const redirectTo = searchParams.get('redirect') ?? null

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password reset flow — send user to the reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/dashboard/reset-password`)
      }

      // Normal sign-up confirmation — route by role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        const dest = redirectTo
          ?? (profile?.role === 'fleet_admin' ? '/dashboard/fleet' : '/dashboard/homeowner')

        return NextResponse.redirect(`${origin}${dest}`)
      }
    }
  }

  // Fallback: redirect to login with an error message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
