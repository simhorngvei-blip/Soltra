'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, X } from 'lucide-react'

export interface ToastData {
  id:      string
  message: string
  type:    'success' | 'error'
}

// ─── Single Toast ─────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-xs font-mono shadow-lg backdrop-blur-sm ${
        toast.type === 'success'
          ? 'border-emerald-800 bg-emerald-950/80 text-emerald-300'
          : 'border-red-800 bg-red-950/80 text-red-300'
      }`}
    >
      {toast.type === 'success'
        ? <CheckCircle size={14} className="shrink-0" />
        : <XCircle    size={14} className="shrink-0" />
      }
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </motion.div>
  )
}

// ─── Toast Container ──────────────────────────────────────────────────────────
export function ToastContainer({ toasts, onDismiss }: {
  toasts:    ToastData[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── useToast hook ────────────────────────────────────────────────────────────
let _id = 0
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const toast = (message: string, type: ToastData['type'] = 'success') => {
    const id = String(++_id)
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id))

  return { toasts, toast, dismiss }
}
