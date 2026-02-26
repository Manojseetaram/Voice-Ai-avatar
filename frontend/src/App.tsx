
import './App.css'
import Avatar from './components/Avatar'

import { useState, useRef, useEffect } from 'react'


type Status = 'idle' | 'listening' | 'thinking' | 'speaking'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('Hello! I\'m your AI assistant. Press Start to talk with me.')
  const [audioLevel, setAudioLevel] = useState(0)

  const recognitionRef = useRef<any>(null)
  const animFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser

      const trackLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setAudioLevel(avg / 128)
        animFrameRef.current = requestAnimationFrame(trackLevel)
      }
      trackLevel()

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.onresult = (e: any) => {
          const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
          setTranscript(t)
        }
        recognition.onend = () => {
          setStatus('thinking')
          setTimeout(() => {
            setStatus('speaking')
            setResponse(`You said: "${transcript}". I'm processing that...`)
            setTimeout(() => setStatus('idle'), 3000)
          }, 1200)
        }
        recognition.start()
        recognitionRef.current = recognition
      }

      setStatus('listening')
      setTranscript('')
    } catch (err) {
      console.error(err)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setAudioLevel(0)
    setStatus('idle')
  }

  useEffect(() => () => stopListening(), [])

  const statusConfig = {
    idle: { label: 'Ready to talk', color: 'text-slate-400', dot: 'bg-slate-400' },
    listening: { label: 'Listening...', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    thinking: { label: 'Thinking...', color: 'text-amber-400', dot: 'bg-amber-400' },
    speaking: { label: 'Speaking...', color: 'text-violet-400', dot: 'bg-violet-400' },
  }

  const cfg = statusConfig[status]

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-between overflow-hidden relative font-['Sora',sans-serif]">

      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-700/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-48 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-violet-900/30 rounded-full blur-[80px]" />
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-[0.3em] text-violet-400 uppercase">Nova AI</span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6 gap-6">

        {/* Avatar container with ring effects */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulsing rings when listening */}
          {status === 'listening' && (
            <>
              <div className="absolute w-[340px] h-[340px] rounded-full border border-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute w-[290px] h-[290px] rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
            </>
          )}
          {status === 'speaking' && (
            <div className="absolute w-[320px] h-[320px] rounded-full border border-violet-500/30 animate-ping" style={{ animationDuration: '1.8s' }} />
          )}

          {/* Avatar glow base */}
          <div className={`absolute w-[260px] h-[260px] rounded-full transition-all duration-700 blur-2xl ${
            status === 'listening' ? 'bg-emerald-500/15' :
            status === 'speaking' ? 'bg-violet-500/20' :
            status === 'thinking' ? 'bg-amber-500/15' :
            'bg-violet-900/20'
          }`} />

          {/* Avatar canvas wrapper */}
          <div className="relative w-[420px] h-[480px]">
            <Avatar isSpeaking={status === 'speaking'} isListening={status === 'listening'} />
          </div>
        </div>

        {/* Audio level visualizer */}
        <div className="flex items-end justify-center gap-0.5 h-8 w-40">
          {Array.from({ length: 20 }).map((_, i) => {
            const h = status === 'listening'
              ? Math.max(4, audioLevel * 100 * (0.3 + Math.random() * 0.7) * Math.sin(i / 3 + Date.now() / 300))
              : status === 'speaking'
              ? Math.max(4, 40 * Math.abs(Math.sin(i * 0.5 + Date.now() / 200)))
              : 4
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  status === 'listening' ? 'bg-emerald-400' :
                  status === 'speaking' ? 'bg-violet-400' :
                  'bg-white/10'
                }`}
                style={{ height: `${Math.min(h, 32)}px` }}
              />
            )
          })}
        </div>

        {/* Chat bubble */}
        <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          {transcript && status === 'listening' && (
            <p className="text-emerald-400/80 text-sm mb-2 font-light italic">
              "{transcript}"
            </p>
          )}
          <p className="text-white/90 text-sm leading-relaxed">
            {status === 'thinking' ? (
              <span className="flex items-center gap-1.5 text-amber-400/80">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </span>
            ) : response}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {status === 'idle' || status === 'thinking' ? (
            <button
              onClick={startListening}
              disabled={status === 'thinking'}
              className="group relative flex items-center gap-3 bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-40 text-white font-semibold text-sm tracking-wide rounded-full px-8 py-4 shadow-lg shadow-violet-900/50 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              Start Talking
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="group relative flex items-center gap-3 bg-gradient-to-br from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-semibold text-sm tracking-wide rounded-full px-8 py-4 shadow-lg shadow-rose-900/50 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z"/>
              </svg>
              Stop
            </button>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center">
        <p className="text-white/20 text-xs tracking-widest uppercase">Powered by AI · Nova Assistant</p>
      </footer>
    </div>
  )
}