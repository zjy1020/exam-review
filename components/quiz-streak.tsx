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
