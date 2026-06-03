'use client'

import { useState, useRef, useCallback } from 'react'

// ─── useTTS ───────────────────────────────────────────────────────────────────
// React hook for text-to-speech via the Soltra TTS server.
// Calls POST /api/tts (server-side proxy) — TTS URL is never exposed to browser.
//
// Usage:
//   const { speak, stop, isGenerating, isPlaying, error } = useTTS()
//
//   // Speak with auto-selected voice:
//   await speak('Solar tracking is active. Wind speed is 12 metres per second.')
//
//   // Speak with a specific Kokoro built-in voice:
//   await speak('Good morning.', { profileId: 'af_bella', language: 'en-us' })
//
//   // Stop mid-playback:
//   stop()

interface TTSOptions {
  profileId?: string   // Kokoro voice (e.g. 'af_bella') or UUID of a cloned profile
  language?: string    // BCP-47 language code (e.g. 'en-us', 'ms', 'zh')
}

interface UseTTSReturn {
  speak:        (text: string, options?: TTSOptions) => Promise<void>
  stop:         () => void
  isGenerating: boolean     // True while waiting for audio from TTS server
  isPlaying:    boolean     // True while audio is playing in browser
  error:        string | null
  clearError:   () => void
}

export function useTTS(): UseTTSReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const audioBlobUrl  = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (audioBlobUrl.current) {
      URL.revokeObjectURL(audioBlobUrl.current)
      audioBlobUrl.current = null
    }
    setIsPlaying(false)
  }, [])

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    if (!text?.trim()) return
    if (isGenerating || isPlaying) stop()

    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text:       text.trim(),
          profile_id: options.profileId,
          language:   options.language ?? 'en-us',
        }),
      })

      // ── Handle error responses ────────────────────────────────────────────
      if (!res.ok) {
        let errorMessage = 'TTS failed'
        try {
          const errBody = await res.json() as { error?: string }
          errorMessage = errBody.error ?? errorMessage
        } catch { /* ignore parse error */ }

        if (res.status === 429) {
          setError('Voice server is busy. Please wait a moment and try again.')
        } else if (res.status === 503) {
          setError('Voice server is offline. Start it with: python server.py in software/soltra-tts')
        } else {
          setError(errorMessage)
        }
        return
      }

      // ── Receive audio blob and play ───────────────────────────────────────
      const audioBlob = await res.blob()

      // Revoke any previous blob URL to free memory
      if (audioBlobUrl.current) {
        URL.revokeObjectURL(audioBlobUrl.current)
      }

      const blobUrl         = URL.createObjectURL(audioBlob)
      audioBlobUrl.current  = blobUrl
      const audio           = new Audio(blobUrl)
      audioRef.current      = audio

      audio.addEventListener('play',  () => setIsPlaying(true))
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        URL.revokeObjectURL(blobUrl)
        audioBlobUrl.current = null
      })
      audio.addEventListener('error', () => {
        setError('Failed to play audio')
        setIsPlaying(false)
      })

      await audio.play()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected TTS error'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, isPlaying, stop])

  const clearError = useCallback(() => setError(null), [])

  return { speak, stop, isGenerating, isPlaying, error, clearError }
}
