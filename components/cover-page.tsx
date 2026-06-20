"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { ChevronDown, Settings } from "lucide-react"

const BLUR_KEY = "quiz-cover-blur"

export function CoverPage() {
  const ref = useRef<HTMLDivElement>(null)
  const [vh, setVh] = useState(0)
  const [blur, setBlur] = useState(4)
  const [showSettings, setShowSettings] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVh(window.innerHeight)
    const saved = localStorage.getItem(BLUR_KEY)
    const initial = saved ? Number(saved) : 4
    setBlur(initial)
    document.documentElement.style.setProperty("--cover-blur", `${initial}px`)
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    localStorage.setItem(BLUR_KEY, String(blur))
    document.documentElement.style.setProperty("--cover-blur", `${blur}px`)
  }, [blur])

  // Close settings when clicking outside
  useEffect(() => {
    if (!showSettings) return
    const handler = (e: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    setTimeout(() => document.addEventListener("click", handler), 0)
    return () => document.removeEventListener("click", handler)
  }, [showSettings])

  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, vh * 0.7], [1, 0])
  const scale = useTransform(scrollY, [0, vh * 0.7], [1, 0.95])
  const y = useTransform(scrollY, [0, vh * 0.7], [0, -60])

  return (
    <motion.div
      ref={ref}
      style={{ opacity }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden pointer-events-none"
    >
      {/* Background wallpaper */}
      <div className="absolute inset-0">
        <img
          src="/images/BZ.png"
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Blur overlay */}
      <div
        className="absolute inset-0 transition-[backdrop-filter] duration-300"
        style={{ backdropFilter: "blur(var(--cover-blur))" }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />
      <div className="absolute inset-0 bg-black/10" />

      {/* Content */}
      <motion.div style={{ scale, y }} className="relative z-10 text-center px-6">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/30 mb-8"
        >
          刷题工具
        </motion.p>

        <h1 className="text-6xl sm:text-8xl md:text-9xl font-serif font-bold text-white/95 tracking-tight mb-4 flex flex-wrap justify-center gap-x-4 md:gap-x-6 gap-y-2">
          {["FINAL", "REVIEW"].map((word, wi) => (
            <span key={word} className="flex">
              {word.split("").map((letter, li) => (
                <motion.span
                  key={li}
                  initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    delay: 0.8 + (wi * word.length + li) * 0.06,
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="inline-block"
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-px w-24 bg-white/10 mx-auto my-8 origin-center"
        />

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="text-sm font-mono text-white/40 tracking-widest uppercase mb-4"
        >
          Exam Review Tool
        </motion.p>
      </motion.div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 z-10 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-white/20" />
        <div className="w-2 h-2 rounded-full bg-white/10" />
        <div className="w-2 h-2 rounded-full bg-white/5" />
      </div>

      {/* Blur settings */}
      <div
        ref={sliderRef}
        className="absolute top-8 right-8 z-20 pointer-events-auto"
      >
        {showSettings ? (
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2">
            <span className="text-[10px] font-mono text-white/40">模糊</span>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={blur}
              onChange={(e) => setBlur(Number(e.target.value))}
              className="w-24 h-1 accent-accent cursor-pointer"
            />
            <span className="text-[10px] font-mono text-white/50 w-4 text-right">{blur}</span>
          </div>
        ) : (
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute bottom-20 text-[10px] font-mono text-white/15 tracking-widest uppercase z-10"
      >
        zjy520
      </motion.div>

      {/* Scroll indicator */}
      {vh > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="absolute bottom-8 z-10 flex flex-col items-center gap-2"
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-white/25"
          >
            <ChevronDown size={20} strokeWidth={1.5} />
          </motion.span>
        </motion.div>
      )}
    </motion.div>
  )
}
