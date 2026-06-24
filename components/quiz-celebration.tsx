"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface QuizCelebrationProps {
  triggered: boolean
  type: "milestone" | "confetti" | "complete"
}

const COLORS = ["hsl(var(--accent))", "#ffd700", "#ff6b6b", "#48dbfb", "#ff9ff3", "#54a0ff", "#a78bfa", "#34d399", "#f97316"]

interface Piece {
  id: number; x: number; y: number; color: string; delay: number; size: number; shape: "circle" | "star" | "square"
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

export function QuizCelebration({ triggered, type }: QuizCelebrationProps) {
  const [show, setShow] = useState(false)
  const [showBurst, setShowBurst] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!triggered) return
    const count = type === "complete" ? 60 : type === "milestone" ? 40 : 30
    const shapes: ("circle" | "star" | "square")[] = ["circle", "star", "square"]
    const newPieces = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 80,
      y: 30 + (Math.random() - 0.5) * 30,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      size: 3 + Math.random() * 7,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }))
    setPieces(newPieces)
    setShow(true)
    setShowBurst(true)
    const t = setTimeout(() => { setShow(false); setShowBurst(false) }, 2800)
    return () => clearTimeout(t)
  }, [triggered, type])

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 0.5] }}
            transition={{ duration: 1.2, times: [0, 0.2, 0.6, 1] }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold select-none"
            style={{ color: "hsl(var(--accent))" }}
          >
            ✓
          </motion.div>
          {pieces.map((p) => {
            const angle = Math.random() * 360
            const distance = 20 + Math.random() * 40
            const dx = Math.cos(angle * Math.PI / 180) * distance
            const dy = Math.sin(angle * Math.PI / 180) * distance
            return (
              <motion.div
                key={p.id}
                initial={{ x: `calc(50vw + ${dx}vw)`, y: `calc(40vh + ${dy}vh)`, opacity: 1, rotate: 0, scale: 0 }}
                animate={{ x: `calc(50vw + ${dx * 2}vw)`, y: "105vh", opacity: 0, rotate: 720, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2 + p.delay, ease: "easeOut" }}
                className="absolute"
                style={{ width: p.size, height: p.size }}
              >
                {p.shape === "circle" && (
                  <div className="w-full h-full rounded-full" style={{ backgroundColor: p.color }} />
                )}
                {p.shape === "square" && (
                  <div className="w-full h-full rotate-45 rounded-sm" style={{ backgroundColor: p.color }} />
                )}
                {p.shape === "star" && (
                  <div className="w-full h-full" style={{ color: p.color }}>
                    <Star />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
