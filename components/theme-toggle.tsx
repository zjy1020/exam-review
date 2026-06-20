"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
    setMounted(true)
  }, [])

  const toggle = () => {
    const html = document.documentElement
    const currentlyDark = html.classList.contains("dark")
    html.classList.toggle("dark", !currentlyDark)
    localStorage.setItem("quiz-theme", currentlyDark ? "light" : "dark")
    setIsDark(!currentlyDark)
  }

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-lg border border-border/60" aria-hidden="true" />
    )
  }

  return (
    <button
      onClick={toggle}
      className="relative w-8 h-8 flex items-center justify-center border border-border/60 bg-background/50 backdrop-blur-sm hover:bg-accent/10 hover:border-accent/30 transition-all duration-200 rounded-lg"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
    </button>
  )
}
