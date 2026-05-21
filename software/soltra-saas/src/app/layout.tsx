import type { Metadata } from 'next'
import { Bebas_Neue, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/components/providers/auth-provider'
import './globals.css'
import { LenisProvider } from '@/components/providers/lenis-provider'

const bebas = Bebas_Neue({ 
  weight: '400',
  subsets: ['latin'], 
  variable: '--font-bebas' 
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains'
})

export const metadata: Metadata = {
  title: { default: 'SOLTRA Solar', template: '%s | SOLTRA Solar' },
  description: 'Autonomous solar tracking — powered by Project SOLTRA',
  keywords: ['solar', 'IoT', 'tracking', 'telemetry', 'SOLTRA'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bebas.variable} ${jetbrains.variable}`}>
      <body className="font-mono antialiased bg-black">
        {/* SVG Noise Filter */}
        <div className="grain-overlay">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <filter id="noiseFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
        </div>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <LenisProvider>
              {children}
            </LenisProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
