import { NextRequest, NextResponse } from 'next/server'

// ─── POST /api/tts ────────────────────────────────────────────────────────────
// Server-side proxy to the Soltra TTS server (Kokoro + Chatterbox).
//
// Why a proxy?
//   The TTS server URL (TTS_URL) is a server-side env var with no NEXT_PUBLIC_
//   prefix. It is never sent to the browser. This allows the same SaaS code to
//   work with:
//     - Local dev:    TTS_URL=http://127.0.0.1:8099
//     - Production:   TTS_URL=https://xxxx.trycloudflare.com
//   without any code changes — just change the env var.
//
// Request body (JSON):
//   { text: string, profile_id?: string, language?: string }
//
//   profile_id can be:
//     - A Kokoro built-in voice  (e.g. "af_bella", "am_adam")  → fast, no cloning
//     - A UUID                   (cloned voice profile)         → Chatterbox
//     - Omitted                  → auto-selects first available profile
//
// Response:
//   audio/wav stream  (same as TTS server /generate response)
//   Or JSON error on failure.
//
// Status codes from TTS server:
//   200 → audio/wav stream
//   404 → profile not found
//   429 → TTS is busy (one generation at a time)
//   503 → TTS server offline / not started

const TTS_URL = process.env.TTS_URL ?? 'http://127.0.0.1:8099'

export async function POST(req: NextRequest) {
  // ── Parse request body ───────────────────────────────────────────────────
  let body: { text: string; profile_id?: string; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, profile_id, language = 'en-us' } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  // ── Resolve profile_id: if not provided, fetch first available profile ────
  let resolvedProfileId = profile_id

  if (!resolvedProfileId) {
    try {
      const profilesRes = await fetch(`${TTS_URL}/profiles`, {
        signal: AbortSignal.timeout(4000),
      })
      if (profilesRes.ok) {
        const profiles = await profilesRes.json() as { id: string }[]
        if (profiles.length > 0) {
          resolvedProfileId = profiles[0].id
        }
      }
    } catch {
      // TTS offline — fall through to the generate call which will also fail
    }

    // If no cloned profiles exist, use a built-in Kokoro voice as default
    if (!resolvedProfileId) {
      resolvedProfileId = 'af_bella'
    }
  }

  // ── Forward to TTS server ─────────────────────────────────────────────────
  const formData = new FormData()
  formData.append('text', text.trim())
  formData.append('profile_id', resolvedProfileId)
  formData.append('language', language)

  let ttsResponse: Response
  try {
    ttsResponse = await fetch(`${TTS_URL}/generate`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60_000), // 60s max (Chatterbox can be slow on CPU)
    })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    const isRefused = err instanceof Error && err.message.includes('ECONNREFUSED')

    if (isRefused) {
      return NextResponse.json(
        { error: 'Voice server is offline. Start it with: python server.py in software/soltra-tts' },
        { status: 503 }
      )
    }
    if (isTimeout) {
      return NextResponse.json(
        { error: 'Voice server timed out. Try a shorter text.' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to reach TTS server' },
      { status: 502 }
    )
  }

  // ── Pass through error responses from TTS server ─────────────────────────
  if (!ttsResponse.ok) {
    let detail = ttsResponse.statusText
    try {
      const errBody = await ttsResponse.json() as { detail?: string }
      detail = errBody.detail ?? detail
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: detail },
      { status: ttsResponse.status }
    )
  }

  // ── Stream audio/wav back to browser ─────────────────────────────────────
  const engine = ttsResponse.headers.get('X-TTS-Engine') ?? 'unknown'

  return new NextResponse(ttsResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'X-TTS-Engine': engine,
      'Cache-Control': 'no-store',
    },
  })
}
