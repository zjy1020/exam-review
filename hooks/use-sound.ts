"use client"

import { useCallback, useRef, useState, useEffect } from "react"

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const correctAudioRef = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem("quiz-sound-muted") === "true" }
    catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem("quiz-sound-muted", muted ? "true" : "false") }
    catch { /* ignore */ }
  }, [muted])

  useEffect(() => {
    const audio = new Audio("/sounds/laugh.mp3")
    audio.loop = true
    audio.volume = 0.6
    correctAudioRef.current = audio
    return () => { audio.pause(); audio.src = "" }
  }, [])

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

  const playCorrect = useCallback(() => {
    if (muted) return
    try {
      const audio = correctAudioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play()
      }
    } catch { /* ignore */ }
  }, [muted])

  const stopCorrect = useCallback(() => {
    try {
      const audio = correctAudioRef.current
      if (audio) { audio.pause(); audio.currentTime = 0 }
    } catch { /* ignore */ }
  }, [])

  const playWrong = useCallback(() => playTone(220, 0.25, "square"), [playTone])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  return { playCorrect, stopCorrect, playWrong, muted, toggleMute }
}
