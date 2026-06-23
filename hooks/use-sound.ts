"use client"

import { useCallback, useRef, useState, useEffect } from "react"

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem("quiz-sound-muted") === "true" }
    catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem("quiz-sound-muted", muted ? "true" : "false") }
    catch { /* ignore */ }
  }, [muted])

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = "sine") => {
    if (muted) return
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch { /* ignore */ }
  }, [muted, getCtx])

  const playCorrect = useCallback(() => playTone(880, 0.15), [playTone])
  const playWrong = useCallback(() => playTone(220, 0.25, "square"), [playTone])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  return { playCorrect, playWrong, muted, toggleMute }
}
