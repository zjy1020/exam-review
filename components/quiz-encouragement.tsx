"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const CORRECT_MSGS = ["漂亮！", "继续保持！", "太强了！", "就是这个！", "稳！", "完美！", "答对了！"]
const WRONG_MSGS = ["下次一定！", "再想想～", "别灰心！", "看好你！", "加油！", "没关系！"]
const STREAK_MSGS = [
  { min: 5, msg: "🔥 x5 势如破竹！" },
  { min: 10, msg: "🔥 x10 无人能挡！" },
  { min: 15, msg: "🔥 x15 天神下凡！" },
  { min: 20, msg: "💥 x20 超越极限！" },
]

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getStreakMsg(streak: number) {
  const found = [...STREAK_MSGS].reverse().find((s) => streak >= s.min)
  return found?.msg || null
}

interface QuizEncouragementProps {
  streak: number
  lastCorrect: boolean | null
}

export function QuizEncouragement({ streak, lastCorrect }: QuizEncouragementProps) {
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (lastCorrect === null) return
    let text: string
    const streakMsg = getStreakMsg(streak)
    if (streak >= 5 && streakMsg) {
      text = streakMsg
    } else if (lastCorrect) {
      text = pickRandom(CORRECT_MSGS)
    } else {
      text = pickRandom(WRONG_MSGS)
    }
    setMsg(text)
    setKey((k) => k + 1)
    const t = setTimeout(() => setMsg(null), 1500)
    return () => clearTimeout(t)
  }, [streak, lastCorrect])

  return (
    <div className="h-5 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {msg && (
          <motion.span
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`text-xs font-mono font-bold ${
              lastCorrect ? "text-accent" : "text-destructive"
            } animate-encouragement-in`}
          >
            {msg}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
