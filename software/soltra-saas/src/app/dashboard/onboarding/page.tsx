'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createSite, createNode } from '@/app/actions/onboarding'
import { useRouter } from 'next/navigation'
import { CheckCircle, Server, MapPin, ChevronRight, Loader2 } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────────
const TIMEZONES = [
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Bangkok',
  'Asia/Kolkata',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
]

const TOTAL_STEPS = 3

// ─── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`
            flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold transition-all
            ${i + 1 === current
              ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
              : i + 1 < current
              ? 'bg-primary/20 text-primary'
              : 'bg-zinc-800 text-zinc-600'
            }
          `}>
            {i + 1 < current ? <CheckCircle size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-12 h-px ${i + 1 < current ? 'bg-primary/40' : 'bg-zinc-800'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Field component ──────────────────────────────────────────────────────────
function Field({
  label, children,
}: {
  label: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2 block">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full bg-zinc-900 border border-zinc-700 p-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-all rounded-lg'

// ─── Onboarding Wizard ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep]     = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Step 1 fields
  const [siteName, setSiteName]   = useState('')
  const [location, setLocation]   = useState('')
  const [timezone, setTimezone]   = useState('Asia/Kuala_Lumpur')

  // Step 2 fields
  const [mac, setMac]     = useState('')
  const [label, setLabel] = useState('')

  // Created entity IDs (passed between steps)
  const [siteId, setSiteId]       = useState<string | null>(null)
  const [createdMac, setCreatedMac] = useState<string>('')
  const [resolvedSiteName, setResolvedSiteName] = useState('')

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const site = await createSite({ name: siteName, location, timezone })
      setSiteId(site.id)
      setResolvedSiteName(site.name)
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!siteId) { setError('No site created. Please restart.'); return }
    setIsLoading(true)
    try {
      const node = await createNode({ siteId, mac, label })
      setCreatedMac(node.mac_address)
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register node')
    } finally {
      setIsLoading(false)
    }
  }

  const slideVariants = {
    enter:  { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit:   { opacity: 0, x: -40 },
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.4em] text-zinc-500 uppercase">
              SOLTRA // System Setup
            </span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-100">Let's get you set up</h1>
          <p className="text-sm text-zinc-500 mt-2">Configure your installation in 3 quick steps</p>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Site ────────────────────────────────────────────── */}
            {step === 1 && (
              <motion.form
                key="step-1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleStep1}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-6">
                  <MapPin size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-zinc-200">Name Your Installation</h2>
                </div>

                <Field label="Site Name">
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="e.g. My Home, Rooftop Array A"
                    className={inputClass}
                  />
                </Field>

                <Field label="City / Region (optional)">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Kuala Lumpur, Malaysia"
                    className={inputClass}
                  />
                </Field>

                <Field label="Timezone">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={inputClass}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </Field>

                {error && <ErrorBlock message={error} />}

                <SubmitButton isLoading={isLoading} label="Continue" />
              </motion.form>
            )}

            {/* ── Step 2: Node ─────────────────────────────────────────────── */}
            {step === 2 && (
              <motion.form
                key="step-2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleStep2}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Server size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-zinc-200">Register Your Node</h2>
                </div>

                <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-2 text-xs text-zinc-400 font-mono">
                  Site: <span className="text-emerald-400">{resolvedSiteName}</span>
                </div>

                <Field label="Node MAC Address">
                  <input
                    type="text"
                    value={mac}
                    onChange={(e) => setMac(e.target.value.toUpperCase())}
                    required
                    pattern="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"
                    placeholder="AA:BB:CC:DD:EE:FF"
                    title="MAC address format: XX:XX:XX:XX:XX:XX"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-zinc-600 mt-1.5 font-mono">
                    Find the MAC address printed on your SOLTRA node or in the firmware serial output.
                  </p>
                </Field>

                <Field label="Node Label (optional)">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Rooftop Array A, South Panel"
                    maxLength={60}
                    className={inputClass}
                  />
                </Field>

                {error && <ErrorBlock message={error} />}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null) }}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
                  >
                    ← Back
                  </button>
                  <SubmitButton isLoading={isLoading} label="Register Node" className="flex-1" />
                </div>
              </motion.form>
            )}

            {/* ── Step 3: Success ──────────────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step-3"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="text-center space-y-6 py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="flex justify-center"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-950 border-2 border-emerald-500/50 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </motion.div>

                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">System Online</h2>
                  <p className="text-sm text-zinc-500 mt-2">Your SOLTRA installation is configured.</p>
                </div>

                <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-4 py-3 text-left space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Site</span>
                    <span className="text-emerald-400">{resolvedSiteName}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Node MAC</span>
                    <span className="text-zinc-300">{createdMac}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Status</span>
                    <span className="text-amber-400">Awaiting First Telemetry…</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 font-mono">
                  Power on your SOLTRA node and verify it is connected to the internet.
                  The dashboard will go live once telemetry packets are received.
                </p>

                <button
                  onClick={() => router.push('/dashboard/homeowner')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-sm font-semibold transition-all active:scale-95"
                >
                  Launch Dashboard <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs font-mono flex gap-2">
      <span>[!]</span> {message}
    </div>
  )
}

function SubmitButton({
  isLoading, label, className = '',
}: {
  isLoading: boolean; label: string; className?: string
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={`flex items-center justify-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 py-3 text-sm font-semibold transition-all hover:bg-white active:scale-95 disabled:opacity-50 ${className}`}
    >
      {isLoading ? (
        <><Loader2 size={14} className="animate-spin" /> Processing…</>
      ) : (
        <>{label} <ChevronRight size={14} /></>
      )}
    </button>
  )
}
