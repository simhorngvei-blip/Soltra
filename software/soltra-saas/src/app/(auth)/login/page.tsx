'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { Lock, Mail, Shield, User, KeyRound } from 'lucide-react'

// ─── Role Selector Card ──────────────────────────────────────────────────────
function RoleCard({
  selected, onSelect, icon: Icon, title, desc,
}: {
  selected: boolean; onSelect: () => void; icon: any; title: string; desc: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 industrial-border p-4 text-left transition-all ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
          : 'border-zinc-800 bg-background/50 hover:border-primary/30'
      }`}
    >
      <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-primary' : 'text-zinc-600'}`} />
      <p className={`text-sm font-sans tracking-widest uppercase ${selected ? 'text-primary' : 'text-zinc-500'}`}>
        {title}
      </p>
      <p className="text-[10px] font-mono text-zinc-700 mt-1 uppercase">{desc}</p>
    </button>
  )
}

type Mode = 'signin' | 'signup' | 'reset'

// ─── Main Form ──────────────────────────────────────────────────────────────
function LoginForm() {
  const supabase    = createClient()
  const router      = useRouter()
  const searchParams = useSearchParams()
  const redirectTo  = searchParams.get('redirect')
  const urlError    = searchParams.get('error')

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [role, setRole]               = useState<'homeowner' | 'fleet_admin'>('homeowner')
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(
    urlError === 'auth_callback_failed' ? 'AUTH_CALLBACK_FAIL: CHECK_EMAIL_LINK' : null
  )
  const [success, setSuccess]         = useState<string | null>(null)
  const [mode, setMode]               = useState<Mode>('signin')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    // ── Password Reset ─────────────────────────────────────────────────────
    if (mode === 'reset') {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      })
      if (resetErr) {
        setError(`RESET_FAIL: ${resetErr.message.toUpperCase()}`)
      } else {
        setSuccess('RESET_LINK_SENT: CHECK_YOUR_EMAIL')
      }
      setIsLoading(false)
      return
    }

    // ── Sign In ────────────────────────────────────────────────────────────
    if (mode === 'signin') {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError(`AUTH_FAIL: ${signInErr.message.toUpperCase()}`)
        setIsLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        const dest = redirectTo
          ?? (profile?.role === 'fleet_admin' ? '/dashboard/fleet' : '/dashboard/homeowner')

        router.push(dest)
        router.refresh()
      }
      setIsLoading(false)
      return
    }

    // ── Sign Up ────────────────────────────────────────────────────────────
    if (password.length < 8) {
      setError('CRITICAL_ERROR: PASSWORD_MIN_LENGTH_8_CHARS')
      setIsLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('CRITICAL_ERROR: PASSWORD_MISMATCH')
      setIsLoading(false)
      return
    }

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        // Ensures confirmation links redirect to the correct domain in production
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })

    if (signUpErr) {
      setError(`SIGNUP_FAIL: ${signUpErr.message.toUpperCase()}`)
      setIsLoading(false)
      return
    }

    setSuccess('UPLINK_SUCCESS: CHECK_EMAIL_FOR_CONFIRMATION_LINK')
    setMode('signin')
    setIsLoading(false)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
  }

  const submitLabel = {
    signin: isLoading ? 'AUTHENTICATING…' : 'AUTHORIZE_UPLINK',
    signup: isLoading ? 'REGISTERING…'    : 'CREATE_OPERATOR_ID',
    reset:  isLoading ? 'TRANSMITTING…'   : 'SEND_RESET_LINK',
  }[mode]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="industrial-border bg-background/60 backdrop-blur-md p-8 shadow-2xl border-primary/20"
    >
      {/* Mode Tabs */}
      <div className="flex bg-muted/30 p-1 mb-8 industrial-border border-primary/10">
        {(['signin', 'signup', 'reset'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-[10px] font-mono tracking-widest uppercase transition-all ${
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-zinc-600 hover:text-primary/60'
            }`}
          >
            {m === 'signin' ? 'Sign In' : m === 'signup' ? 'Register' : 'Reset'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
            IDENT_EMAIL
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
              placeholder="operator@nexus.sys"
            />
          </div>
        </div>

        {/* Password (hidden on reset mode) */}
        {mode !== 'reset' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
                ACCESS_KEY
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[10px] font-mono text-zinc-600 hover:text-primary/60 transition-colors"
                >
                  FORGOT?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
        )}

        {/* Confirm Password (signup only) */}
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
              CONFIRM_KEY
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
                placeholder="••••••••"
              />
            </div>
          </motion.div>
        )}

        {/* Role Selector (signup only) */}
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-3 block">
              ASSIGN_ROLE
            </label>
            <div className="flex gap-3">
              <RoleCard
                selected={role === 'homeowner'}
                onSelect={() => setRole('homeowner')}
                icon={User}
                title="Homeowner"
                desc="Resid. Site"
              />
              <RoleCard
                selected={role === 'fleet_admin'}
                onSelect={() => setRole('fleet_admin')}
                icon={Shield}
                title="Fleet Admin"
                desc="Comm. Array"
              />
            </div>
          </motion.div>
        )}

        {/* Reset mode info */}
        {mode === 'reset' && (
          <div className="p-3 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-mono">
            <KeyRound size={12} className="inline mr-2 opacity-60" />
            Enter your registered email. A secure reset link will be transmitted to your inbox.
          </div>
        )}

        {/* Error / Success Messages */}
        {error && (
          <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="animate-pulse">[!]</span> {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-primary/10 border border-primary/30 text-primary text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
            <span>[✓]</span> {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full industrial-border bg-primary text-primary-foreground py-4 font-sans text-xl tracking-tight transition-all active:scale-95 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="industrial-border bg-background/60 p-12 text-center text-[10px] font-mono uppercase tracking-[0.4em] text-primary/40">
        Establishing Secure Connection...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
