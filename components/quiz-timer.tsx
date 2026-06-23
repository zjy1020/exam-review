"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Timer, TimerOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuizTimerProps {
  enabled: boolean
  onToggle: () => void
  onTimeUp: () => void
  isSubmitted: boolean
  key_: number
}

export function QuizTimer({ enabled, onToggle, onTimeUp, isSubmitted, key_ }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(15)
  const calledRef = useRef(false)

  useEffect(() => {
    calledRef.current = false
    setTimeLeft(15)
  }, [key_])

  useEffect(() => {
    if (!enabled || isSubmitted) return
    if (timeLeft <= 0) {
      if (!calledRef.current) {
        calledRef.current = true
        onTimeUp()
      }
      return
    }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(t)
  }, [enabled, timeLeft, isSubmitted, onTimeUp])

  const urgent = timeLeft <= 5

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="text-xs font-mono gap-1 text-muted-foreground hover:text-foreground"
        title={enabled ? "关闭计时" : "开启计时（15秒）"}
      >
        {enabled ? <Timer size={14} strokeWidth={1.5} /> : <TimerOff size={14} strokeWidth={1.5} />}
        <span className="hidden sm:inline text-[10px]">计时</span>
      </Button>
      {enabled && !isSubmitted && (
        <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums ${
          urgent
            ? "bg-destructive/20 text-destructive animate-pulse"
            : "bg-accent/20 text-accent"
        }`}>
          {timeLeft}s
        </span>
      )}
    </div>
  )
}
