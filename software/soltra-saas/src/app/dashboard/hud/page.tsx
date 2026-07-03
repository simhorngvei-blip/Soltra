import React from 'react'

export default function HUDPage() {
  const hudUrl = process.env.NEXT_PUBLIC_HUD_URL || 'http://localhost:5173'
  
  return (
    <div className="flex flex-col h-full w-full">
      <header className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span className="text-red-400">🔺</span> System HUD
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Real-time system heads-up display</p>
        </div>
        <a 
          href={hudUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
        >
          Open in New Tab ↗
        </a>
      </header>
      
      <div className="flex-1 w-full bg-black">
        <iframe 
          src={hudUrl} 
          className="w-full h-full border-0"
          title="System HUD"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
