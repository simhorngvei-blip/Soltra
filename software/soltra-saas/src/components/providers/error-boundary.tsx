'use client'

import { Component, type ReactNode } from 'react'

interface Props  { children: ReactNode; fallback?: ReactNode }
interface State  { hasError: boolean; error: Error | null }

/**
 * React Error Boundary — catches render errors in the component subtree.
 * Wrap any widget or panel that makes external calls (Supabase, MQTT proxies)
 * to prevent one crashed panel from taking down the entire page.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Chart failed to load</p>}>
 *     <TelemetryAreaChart ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
          <p className="text-xs font-mono text-red-500 uppercase tracking-widest mb-2">
            [!] Component Error
          </p>
          <p className="text-sm text-zinc-400 font-mono">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 text-xs font-mono text-zinc-500 hover:text-zinc-300 underline transition-colors"
          >
            ↺ Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
