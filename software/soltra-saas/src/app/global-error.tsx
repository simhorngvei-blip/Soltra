'use client'

// global-error.tsx must include its own <html> and <body> tags.
// It replaces the root layout when a fatal error occurs in the RootLayout itself.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#09090b', color: '#e4e4e7', fontFamily: 'monospace' }}>
        <div
          style={{
            minHeight:      '100vh',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '2rem',
            textAlign:      'center',
          }}
        >
          <div style={{ maxWidth: '32rem' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: '#52525b', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              SOLTRA Protocol // Critical System Fault
            </p>
            <div style={{ fontSize: 'clamp(4rem, 15vw, 8rem)', lineHeight: 1, color: '#ef4444', fontStyle: 'italic', marginBottom: '1rem' }}>
              CRIT
            </div>
            <p style={{ fontSize: '0.75rem', color: '#ef4444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              GLOBAL_RENDER_FAULT
            </p>
            {error.message && (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '0.5rem', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.65rem', color: '#52525b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Error</p>
                <p style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{error.message}</p>
              </div>
            )}
            <button
              onClick={reset}
              style={{
                background:   '#052e16',
                border:       '1px solid #14532d',
                color:        '#4ade80',
                borderRadius: '0.5rem',
                padding:      '0.625rem 1.25rem',
                fontSize:     '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor:       'pointer',
              }}
            >
              ↺ Restart Application
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
