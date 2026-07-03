import { NextRequest, NextResponse } from 'next/server'

// ─── CV Backend Proxy ─────────────────────────────────────────────────────────
// Proxies /api/cv?action=start|stop to the CV backend server-side,
// avoiding CORS preflight issues caused by ngrok intercepting OPTIONS requests.

export async function POST(req: NextRequest) {
  const cvUrl = process.env.NEXT_PUBLIC_CV_BACKEND_URL
  if (!cvUrl) {
    return NextResponse.json({ error: 'CV backend URL not configured.' }, { status: 500 })
  }

  const { action } = await req.json()
  if (action !== 'start' && action !== 'stop') {
    return NextResponse.json({ error: 'Invalid action. Must be "start" or "stop".' }, { status: 400 })
  }

  try {
    const res = await fetch(`${cvUrl}/api/track/${action}`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      return NextResponse.json({ error: `CV backend returned ${res.status}: ${text}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Could not reach CV backend. Is the tunnel running?' }, { status: 503 })
  }
}
