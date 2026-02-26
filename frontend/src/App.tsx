import './App.css'
import Avatar from './components/Avatar'
import { useState, useRef, useEffect } from 'react'

type Status = 'idle' | 'listening' | 'speaking'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SR) {
        const r = new SR()
        r.continuous = true
        r.interimResults = true
        r.onend = () => setStatus('idle')
        r.start()
        recognitionRef.current = r
      }
      setStatus('listening')
    } catch (err) {
      console.error(err)
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStatus('idle')
  }

  useEffect(() => () => stopListening(), [])

  return (
    <div className="fixed inset-0 bg-[#08060f] flex flex-col items-center justify-end overflow-hidden">

      {/* Subtle ambient glow behind character */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] rounded-full transition-all duration-700"
        style={{
          background: status === 'listening'
            ? 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)'
            : status === 'speaking'
            ? 'radial-gradient(ellipse, rgba(168,85,247,0.14) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Avatar — fills most of screen, anchored to bottom */}
      <div className="relative w-full flex-1 flex items-end justify-center">
        <Avatar isSpeaking={status === 'speaking'} isListening={status === 'listening'} />
      </div>

      {/* Bottom controls — just the button */}
      <div className="relative z-10 w-full flex justify-center pb-10 pt-4">
        {status === 'idle' ? (
          <button
            onClick={startListening}
            className="flex items-center gap-3 px-10 py-4 rounded-full text-white font-semibold text-base tracking-wide transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              boxShadow: '0 0 32px rgba(99,102,241,0.5), 0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            Start
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="flex items-center gap-3 px-10 py-4 rounded-full text-white font-semibold text-base tracking-wide transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 0 32px rgba(220,38,38,0.5), 0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            Stop
          </button>
        )}
      </div>
    </div>
  )
}