"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface QuizCelebrationProps {
  triggered: boolean
  type: "milestone" | "confetti" | "complete"
}

const COLORS = ["hsl(var(--accent))", "#ffd700", "#ff6b6b", "#48dbfb", "#ff9ff3", "#54a0ff"]

export function QuizCelebration({ triggered, type }: QuizCelebrationProps) {
  const [show, setShow] = useState(false)
  const [pieces, setPieces] = useState<{ id: number; x: number; color: string; delay: number }[]>([])

  useEffect(() => {
    if (!triggered) return
    const count = type === "complete" ? 40 : type === "milestone" ? 20 : 15
    const newPieces = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.3,
    }))
    setPieces(newPieces)
    setShow(true)
    const t = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(t)
  }, [triggered, type])

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {pieces.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
              animate={{ y: "100vh", opacity: 0, rotate: 720 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 + p.delay, ease: "easeIn" }}
              className="absolute top-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: p.color, left: `${p.x}%` }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
