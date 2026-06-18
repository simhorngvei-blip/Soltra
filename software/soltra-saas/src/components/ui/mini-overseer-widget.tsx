'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, User, X, Volume2 } from 'lucide-react'
import { useTTS } from '@/hooks/useTTS'

const OVERSEER_URL = process.env.NEXT_PUBLIC_MINI_OVERSEER_URL || 'http://127.0.0.1:8100'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function MiniOverseerWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'SYSTEM ONLINE. AWAITING INPUT.' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Use our new TTS hook
  const { speak } = useTTS()

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(scrollToBottom, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setIsLoading(true)

    try {
      // 1. Send to Dual-Memory Python Backend
      const response = await fetch(`${OVERSEER_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          // Sending an empty object for telemetry context globally
          telemetry: {}
        })
      })

      if (!response.ok) throw new Error("Backend connection failed.")
      const data = await response.json()
      const aiResponse = data.response

      setMessages(prev => [...prev, { role: 'assistant', text: aiResponse }])

      // 2. Trigger TTS
      try {
        await speak(aiResponse, { language: 'en-us' })
      } catch (ttsErr) {
        console.error("[Widget] TTS Generation failed:", ttsErr)
      }
    } catch (err: any) {
      console.error("[Widget] Chat failed:", err)
      setMessages(prev => [...prev, { role: 'assistant', text: `ERROR: ${err.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 p-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] z-50 transition-colors"
          >
            <Bot size={28} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mini-Overseer Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 w-80 sm:w-96 bg-[#0a0a0a]/90 backdrop-blur-xl border border-cyan-900/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 font-sans"
            style={{ height: '500px', maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-cyan-950/40 border-b border-cyan-900/50">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bot size={20} className="text-cyan-400" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <h3 className="text-cyan-100 font-medium text-sm tracking-wide">MINI-OVERSEER</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-cyan-600 hover:text-cyan-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Telemetry Status Bar - Mocked for global view */}
            <div className="px-4 py-1.5 bg-cyan-900/20 border-b border-cyan-900/30 flex justify-between items-center text-[10px] text-cyan-400/70 uppercase tracking-wider">
              <span>WND: -- m/s</span>
              <span>BAT: -- %</span>
              <span>SYS: GLOBAL WIDGET</span>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-zinc-800' : 'bg-cyan-900/50 border border-cyan-700/50'
                  }`}>
                    {msg.role === 'user' ? <User size={14} className="text-zinc-400" /> : <Bot size={14} className="text-cyan-400" />}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm' 
                      : 'bg-cyan-950/30 text-cyan-50 rounded-tl-sm border border-cyan-900/30'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-700/50 flex items-center justify-center">
                    <Bot size={14} className="text-cyan-400" />
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-cyan-950/30 border border-cyan-900/30 text-cyan-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#0a0a0a] border-t border-cyan-900/30">
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Communicate with Overseer..."
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-cyan-700/50 text-cyan-50 text-sm rounded-full pl-4 pr-12 py-2.5 outline-none transition-colors placeholder:text-zinc-600"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 top-1.5 bottom-1.5 w-8 flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-full transition-colors"
                >
                  <Volume2 size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
