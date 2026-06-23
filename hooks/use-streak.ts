"use client"

import { useState, useCallback, useRef } from "react"

interface StreakState {
  current: number
  max: number
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakState>({ current: 0, max: 0 })
  const milestoneTriggeredRef = useRef<Set<string>>(new Set())

  const onAnswer = useCallback((isCorrect: boolean) => {
    setStreak((prev) => {
      if (isCorrect) {
        const next = prev.current + 1
        return { current: next, max: Math.max(prev.max, next) }
      }
      return { ...prev, current: 0 }
    })
  }, [])

  const hasMilestoneTriggered = useCallback((milestone: number) => {
    const key = `milestone-${milestone}`
    if (milestoneTriggeredRef.current.has(key)) return true
    milestoneTriggeredRef.current.add(key)
    return false
  }, [])

  const resetStreak = useCallback(() => {
    setStreak({ current: 0, max: 0 })
    milestoneTriggeredRef.current.clear()
  }, [])

  return { streak, onAnswer, resetStreak, hasMilestoneTriggered }
}
