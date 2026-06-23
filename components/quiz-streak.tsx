"use client"

import { motion } from "framer-motion"

interface QuizStreakProps {
  streak: number
  maxStreak: number
  focusMode?: boolean
}

const STREAK_TIERS = [
  { min: 20, className: "text-yellow-400 text-lg", icon: "💥" },
  { min: 15, className: "text-orange-400", icon: "🔥" },
  { min: 10, className: "text-accent", icon: "🔥" },
  { min: 5, className: "text-accent/70", icon: "🔥" },
  { min: 0, className: "text-muted-foreground", icon: "🔥" },
]

function getTier(streak: number) {
  return STREAK_TIERS.find((t) => streak >= t.min) || STREAK_TIERS[STREAK_TIERS.length - 1]
}

export function QuizStreak({ streak, maxStreak, focusMode }: QuizStreakProps) {
  if (streak < 2) return null
  const tier = getTier(streak)

  if (focusMode) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-1 bg-background/60 backdrop-blur-sm px-2 py-1 rounded-full border border-border/30">
        <span className="text-xs">{tier.icon}</span>
        <span className="text-[10px] font-mono font-bold text-muted-foreground">x{streak}</span>
      </div>
    )
  }

  return (
    <motion.div
      key={streak}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center gap-1 font-mono font-bold ${tier.className}`}
    >
      <span className="text-sm">{tier.icon}</span>
      <span className="text-xs">x{streak}</span>
    </motion.div>
  )
}
