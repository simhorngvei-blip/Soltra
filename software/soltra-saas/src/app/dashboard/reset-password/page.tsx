'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Shield } from 'lucide-react'

function ResetPasswordForm() {
  const supabase   = createClient()
  const router     = useRouter()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('CRITICAL_ERROR: PASSWORD_MIN_LENGTH_8_CHARS')
      return
    }
    if (password !== confirm) {
      setError('CRITICAL_ERROR: PASSWORD_MISMATCH')
      return
    }

    setIsLoading(true)

    const { error: updateErr } = await supabase.auth.updateUser({ password })

    if (updateErr) {
      setError(`UPDATE_FAIL: ${updateErr.message.toUpperCase()}`)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    // Brief delay so the user sees the success message before redirect
    setTimeout(() => router.push('/dashboard/homeowner'), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="industrial-border bg-background/60 backdrop-blur-md p-8 shadow-2xl border-primary/20"
    >
      <div className="mb-8 text-center">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.4em]">
          Security Protocol
        </p>
        <h1 className="text-2xl font-sans tracking-tight text-white mt-2">
          Set New Access Key
        </h1>
      </div>

      {success ? (
        <div className="p-4 bg-primary/10 border border-primary/30 text-primary text-[10px] font-mono uppercase tracking-widest text-center">
          [✓] PASSWORD_UPDATED — REDIRECTING TO DASHBOARD…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
              NEW_ACCESS_KEY
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
                placeholder="Min. 8 characters"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
              CONFIRM_KEY
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full bg-muted/20 border border-primary/20 p-3 pl-10 text-sm font-mono text-primary placeholder:text-zinc-700 focus:outline-none focus:border-primary/60 transition-all"
                placeholder="Repeat new password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
              <span className="animate-pulse">[!]</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full industrial-border bg-primary text-primary-foreground py-4 font-sans text-xl tracking-tight transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'UPDATING…' : 'COMMIT_NEW_KEY'}
          </button>
        </form>
      )}
    </motion.div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="mb-12 text-center relative z-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 bg-primary animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.4em] text-primary/60 uppercase">
              Password Reset // Secure Channel
            </span>
          </div>
          <p className="text-5xl font-sans tracking-tight text-white uppercase italic">
            SOLTRA<span className="text-primary">.RESET</span>
          </p>
        </div>
        <div className="relative z-10">
          <Suspense fallback={
            <div className="industrial-border bg-background/60 p-12 text-center text-[10px] font-mono uppercase tracking-[0.4em] text-primary/40">
              Verifying Reset Token…
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
