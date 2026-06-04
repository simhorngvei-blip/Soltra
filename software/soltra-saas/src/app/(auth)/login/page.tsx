'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { Lock, Mail, Shield, User, KeyRound, Eye, EyeOff, ShoppingCart } from 'lucide-react'

// ─── Friendly error messages ─────────────────────────────────────────────────
function friendlyError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('auth_fail'))
    return 'Incorrect email or password. Please try again.'
  if (msg.includes('email not confirmed') || msg.includes('not confirmed'))
    return 'Please confirm your email before signing in. Check your inbox.'
  if (msg.includes('user already registered') || msg.includes('already registered'))
    return 'An account with this email already exists. Sign in instead.'
  if (msg.includes('password') && msg.includes('min'))
    return 'Password must be at least 8 characters.'
  if (msg.includes('mismatch') || msg.includes('password_mismatch'))
    return 'Passwords do not match. Please re-enter.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Too many attempts. Please wait a minute and try again.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Connection error. Check your internet and try again.'
  // Strip raw error prefixes like AUTH_FAIL:, SIGNUP_FAIL:, etc.
  return raw.replace(/^[A-Z_]+:\s*/i, '')
}

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

// ─── Password Input ──────────────────────────────────────────────────────────
function PasswordInput({
  value, onChange, placeholder = '••••••••', icon: Icon = Lock, minLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: any
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 pr-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-primary/60 transition-colors"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ─── Main Form ──────────────────────────────────────────────────────────────
function LoginForm() {
  const supabase    = createClient()
  const router      = useRouter()
  const searchParams = useSearchParams()
  const redirectTo  = searchParams.get('redirect')
  const urlError    = searchParams.get('error')
  const tabParam    = searchParams.get('tab')
  const isPurchaseRedirect = redirectTo?.includes('purchase')

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [role, setRole]               = useState<'homeowner' | 'fleet_admin'>('homeowner')
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(
    urlError === 'auth_callback_failed' ? 'Email confirmation failed. Please request a new link.' : null
  )
  const [success, setSuccess]         = useState<string | null>(null)
  const [mode, setMode]               = useState<Mode>(tabParam === 'signup' ? 'signup' : 'signin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin

    // ── Password Reset ─────────────────────────────────────────────────────
    if (mode === 'reset') {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      })
      if (resetErr) {
        setError(friendlyError(resetErr.message))
      } else {
        setSuccess('Reset link sent! Check your email inbox (and spam folder).')
      }
      setIsLoading(false)
      return
    }

    // ── Sign In ────────────────────────────────────────────────────────────
    if (mode === 'signin') {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError(friendlyError(signInErr.message))
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
      setError('Password must be at least 8 characters.')
      setIsLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.')
      setIsLoading(false)
      return
    }

    const siteUrl2 = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: `${siteUrl2}/auth/callback`,
      },
    })

    if (signUpErr) {
      setError(friendlyError(signUpErr.message))
      setIsLoading(false)
      return
    }

    setSuccess('Account created! Check your email for a confirmation link, then sign in.')
    setMode('signin')
    // Keep email pre-filled so user can sign in immediately after confirming
    setPassword('')
    setConfirm('')
    setIsLoading(false)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
  }

  const submitLabel = {
    signin: isLoading ? 'Signing in…' : 'Sign In',
    signup: isLoading ? 'Creating account…' : 'Create Account',
    reset:  isLoading ? 'Sending…' : 'Send Reset Link',
  }[mode]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="industrial-border bg-background/60 backdrop-blur-md p-8 shadow-2xl border-primary/20"
    >
      {/* Purchase redirect notice */}
      {isPurchaseRedirect && (
        <div className="mb-6 p-3 bg-primary/5 border border-primary/20 text-primary text-xs font-mono flex items-center gap-2">
          <ShoppingCart size={12} className="shrink-0" />
          Sign in or create an account to complete your purchase.
        </div>
      )}

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
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
              placeholder="you@example.com"
            />
          </div>
        </div>

        {/* Password */}
        {mode !== 'reset' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[10px] font-mono text-zinc-600 hover:text-primary/60 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              minLength={mode === 'signup' ? 8 : undefined}
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
            />
          </div>
        )}

        {/* Confirm Password (signup only) */}
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
              Confirm Password
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirm}
              icon={Shield}
              placeholder="Repeat your password"
            />
          </motion.div>
        )}

        {/* Role Selector (signup only) */}
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-3 block">
              Account Type
            </label>
            <div className="flex gap-3">
              <RoleCard
                selected={role === 'homeowner'}
                onSelect={() => setRole('homeowner')}
                icon={User}
                title="Homeowner"
                desc="Residential site"
              />
              <RoleCard
                selected={role === 'fleet_admin'}
                onSelect={() => setRole('fleet_admin')}
                icon={Shield}
                title="Fleet Admin"
                desc="Commercial array"
              />
            </div>
          </motion.div>
        )}

        {/* Reset mode info */}
        {mode === 'reset' && (
          <div className="p-3 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-mono">
            <KeyRound size={12} className="inline mr-2 opacity-60" />
            Enter your registered email and we'll send a secure reset link.
          </div>
        )}

        {/* Error / Success Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-950/20 border border-red-900/50 text-red-400 text-xs font-mono flex items-start gap-2"
          >
            <span className="animate-pulse mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-primary/10 border border-primary/30 text-primary text-xs font-mono flex items-start gap-2"
          >
            <span className="shrink-0">✓</span>
            <span>{success}</span>
          </motion.div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full industrial-border bg-primary text-primary-foreground py-4 font-sans text-xl tracking-tight transition-all active:scale-95 disabled:opacity-50 hover:bg-primary/90"
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
        Loading…
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
