"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, ImageIcon, Upload, Check, X } from "lucide-react"

const BLUR_KEY = "quiz-cover-blur"
const BG_KEY = "quiz-bg"

const PRESETS = [
  { id: "none", name: "无壁纸", type: "none" as const, value: "" },
  { id: "bz", name: "默认", type: "image" as const, value: "/images/BZ.png" },
  { id: "iso", name: "等距", type: "image" as const, value: "/images/about-isometric.jpg" },
  { id: "lumen", name: "Lumen骑士", type: "image" as const, value: "/images/wp-lumen.png" },
  { id: "anime-girl", name: "动漫女孩", type: "image" as const, value: "/images/wp-anime-girl.png" },
  { id: "catfeather", name: "猫羽雫", type: "image" as const, value: "/images/wp-catfeather.png" },
  { id: "onepiece", name: "海贼王", type: "image" as const, value: "/images/wp-onepiece.png" },
  { id: "ragdoll", name: "布偶猫", type: "image" as const, value: "/images/wp-ragdoll.png" },
  { id: "wlop-sea", name: "WLOP大海", type: "image" as const, value: "/images/wp-wlop-sea.png" },
  { id: "cg-art", name: "CG插画", type: "image" as const, value: "/images/wp-cg-art.png" },
  { id: "dark-slate", name: "深空蓝", type: "gradient" as const, value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  { id: "warm-amber", name: "暖琥珀", type: "gradient" as const, value: "linear-gradient(135deg, #1a0a00 0%, #4a1a00 50%, #1a0a00 100%)" },
  { id: "cool-teal", name: "冷松绿", type: "gradient" as const, value: "linear-gradient(135deg, #001a1a 0%, #003d33 50%, #001a1a 100%)" },
  { id: "royal-purple", name: "皇家紫", type: "gradient" as const, value: "linear-gradient(135deg, #0d001a 0%, #2d004d 50%, #0d001a 100%)" },
  { id: "charcoal", name: "炭黑", type: "gradient" as const, value: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)" },
  { id: "blood-orange", name: "血橙", type: "gradient" as const, value: "linear-gradient(135deg, #1a0500 0%, #4a1000 50%, #1a0500 100%)" },
]

type CustomBg = { id: string; name: string; type: "custom"; value: string }
interface CoverPageProps { onDismiss: () => void }

function getBgStyle(bg: string) {
  const pipe = bg.indexOf("|")
  if (pipe === -1) return { type: "image" as const, value: bg }
  return { type: bg.substring(0, pipe) as "image" | "gradient" | "custom" | "none", value: bg.substring(pipe + 1) }
}

function PresetGrid({ currentId, customBgs, onSelect, onUploadClick, onDeleteCustom, onClose }: {
  currentId: string; customBgs: CustomBg[]; onSelect: (id: string) => void; onUploadClick: () => void; onDeleteCustom: (id: string) => void; onClose: () => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const pickingRef = useRef(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickingRef.current) { pickingRef.current = false; return }
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener("click", handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener("click", handler) }
  }, [onClose])

  const allPresets = [...PRESETS, ...customBgs.map(c => ({ id: c.id, type: c.type, value: c.value, name: c.name }))]
  return (
    <div ref={gridRef} className="absolute top-12 right-0 z-30 w-[320px] max-h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono tracking-wider text-white/50 uppercase">背景切换</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors"><X size={14} strokeWidth={1.5} /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {allPresets.map((p) => {
          const isActive = p.id === currentId
          const isCustom = customBgs.some(c => c.id === p.id)
          return (
            <div key={p.id} className="relative group">
              <button onClick={() => onSelect(p.id)} className={`relative w-full aspect-[3/2] rounded-lg overflow-hidden border-2 transition-all ${isActive ? "border-accent ring-1 ring-accent/50" : "border-white/10 hover:border-white/30"}`}>
                {p.type === "none" ? <div className="w-full h-full bg-white/5 flex items-center justify-center"><span className="text-[8px] font-mono text-white/20">×</span></div> : p.type === "image" ? <img src={p.value} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: p.value }} />}
                {isActive && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Check size={16} className="text-accent" strokeWidth={3} /></div>}
              </button>
              <p className="text-[9px] font-mono text-white/40 text-center mt-1 truncate">{p.name}</p>
              {isCustom && <button onClick={(e) => { e.stopPropagation(); onDeleteCustom(p.id) }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} strokeWidth={2} /></button>}
            </div>
          )
        })}
        <button
          onMouseDown={() => { pickingRef.current = true }}
          onClick={() => onUploadClick()}
          className="w-full aspect-[3/2] rounded-lg border-2 border-dashed border-white/15 hover:border-white/40 flex flex-col items-center justify-center gap-1 transition-colors text-white/30 hover:text-white/60"
        >
          <Upload size={14} strokeWidth={1.5} /><span className="text-[8px] font-mono">上传</span>
        </button>
      </div>
    </div>
  )
}

export function CoverPage({ onDismiss }: CoverPageProps) {
  const [blur, setBlur] = useState(4)
  const [showSettings, setShowSettings] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [visible, setVisible] = useState(true)
  const [currentBg, setCurrentBg] = useState(`image|${PRESETS[0].value}`)
  const [currentBgId, setCurrentBgId] = useState(PRESETS[0].id)
  const [customBgs, setCustomBgs] = useState<CustomBg[]>([])
  const sliderRef = useRef<HTMLDivElement>(null)
  const bgBtnRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(BLUR_KEY); const initial = saved ? Number(saved) : 4
    setBlur(initial); document.documentElement.style.setProperty("--cover-blur", `${initial}px`)
    const storedBg = localStorage.getItem(BG_KEY)
    if (storedBg) setCurrentBg(storedBg)
    try { const raw = localStorage.getItem("quiz-bg-customs"); if (raw) setCustomBgs(JSON.parse(raw)) } catch {}
  }, [])

  useEffect(() => { localStorage.setItem(BLUR_KEY, String(blur)); document.documentElement.style.setProperty("--cover-blur", `${blur}px`) }, [blur])
  useEffect(() => { localStorage.setItem(BG_KEY, currentBg) }, [currentBg])

  const selectBg = useCallback((id: string) => {
    const found = PRESETS.find(p => p.id === id) || customBgs.find(c => c.id === id)
    if (found) {
      setCurrentBgId(id)
      if (found.type === "image") setCurrentBg(`image|${found.value}`)
      else if (found.type == "none") setCurrentBg(`none|`)
      else setCurrentBg(`gradient|${found.value}`)
  }
  }, [customBgs])

  const handleUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight
        const MAX = 1920
        if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r) }
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h
        const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h)
        const compressed = canvas.toDataURL("image/jpeg", 0.85)
        const id = `custom-${Date.now()}`
        const newBg: CustomBg = { id, name: file.name.substring(0, 12), type: "custom", value: compressed }
        const updated = [...customBgs, newBg]; setCustomBgs(updated)
        localStorage.setItem("quiz-bg-customs", JSON.stringify(updated))
        setCurrentBgId(id); setCurrentBg(`custom|${compressed}`)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [customBgs])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleUpload(f)
    e.target.value = ""
  }, [handleUpload])

  const handleDeleteCustom = useCallback((id: string) => {
    const updated = customBgs.filter(c => c.id !== id); setCustomBgs(updated)
    localStorage.setItem("quiz-bg-customs", JSON.stringify(updated))
    if (currentBgId === id) { setCurrentBgId(PRESETS[0].id); setCurrentBg(`image|${PRESETS[0].value}`) }
  }, [customBgs, currentBgId])

  useEffect(() => {
    if (!showSettings && !showBgPicker) return
    const handler = (e: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(e.target as Node) && bgBtnRef.current && !bgBtnRef.current.contains(e.target as Node)) {
        setShowSettings(false); setShowBgPicker(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener("click", handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener("click", handler) }
  }, [showSettings, showBgPicker])

  const handleBgClick = () => { if (showSettings || showBgPicker) return; setVisible(false); setTimeout(onDismiss, 500) }

  const bgStyle = getBgStyle(currentBg)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: "blur(4px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden"
          onClick={handleBgClick}
        >
          {/* File input at CoverPage level (not inside PresetGrid) */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <div className="absolute inset-0">
            {bgStyle.type === "none" || (bgStyle.type === "image" && !bgStyle.value) ? (
              <div className="w-full h-full bg-[#0a0a0a]" />
            ) : bgStyle.type === "image" || bgStyle.type === "custom" ? (
              <img src={bgStyle.value} alt="" className="w-full h-full object-cover" draggable={false} />
            ) : <div className="w-full h-full" style={{ background: bgStyle.value }} />}
          </div>
          <div className="absolute inset-0 transition-[backdrop-filter] duration-300" style={{ backdropFilter: "blur(var(--cover-blur))" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60 origin-left z-10" />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="absolute top-[6px] left-0 right-[30%] h-[1px] bg-white/10 origin-left z-10" />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-8 sm:px-16 lg:px-24">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-0">
              <div className="lg:max-w-[65%]">
                <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="h-px w-8 bg-accent/60" /><span className="text-[10px] font-mono tracking-[0.35em] uppercase text-white/35">刷题工具</span><div className="h-px flex-1 bg-white/8" />
                </motion.div>
                <h1 className="font-serif font-bold text-white">
                  <span className="flex flex-wrap items-baseline gap-x-3 sm:gap-x-4">
                    <motion.span initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] leading-[0.85] tracking-tight">FINAL</motion.span>
                    <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="text-5xl sm:text-7xl md:text-8xl lg:text-[8rem] leading-[0.85] tracking-tight text-white/50 font-light italic">/</motion.span>
                    <motion.span initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] leading-[0.85] tracking-tight">REVIEW</motion.span>
                  </span>
                </h1>
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="h-[1px] bg-white/15 mt-6 sm:mt-8 mb-4 origin-left" />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.5 }} className="flex items-center gap-4">
                  <span className="text-[11px] font-mono text-white/30 tracking-[0.25em] uppercase">Exam Review Tool</span>
                  <span className="text-white/8 text-[8px]">◆</span>
                  <span className="text-[11px] font-mono text-white/20 tracking-wider">zjy520</span>
                </motion.div>
              </div>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-start lg:items-end gap-3 lg:pb-2">
                <div className="text-right"><div className="text-[10px] font-mono text-white/20 tracking-[0.3em] uppercase">— 期末冲刺 —</div></div>
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                  <span className="text-[10px] font-mono text-white/30 tracking-wider">点击进入</span>
                  <span className="text-white/20 text-xs">→</span>
                </motion.div>
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/8 origin-right z-10" />
          <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.4 }} className="absolute top-8 left-8 z-10 flex flex-col gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent/60" /><div className="w-2 h-2 rounded-full bg-white/10" /><div className="w-2 h-2 rounded-full bg-white/5" />
          </motion.div>

          <div className="absolute top-6 sm:top-8 right-6 sm:right-8 z-20 flex items-center gap-2">
            <div className="relative">
              <button ref={bgBtnRef} onClick={(e) => { e.stopPropagation(); setShowBgPicker(p => !p); setShowSettings(false) }}
                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
                <ImageIcon size={13} strokeWidth={1.5} />
              </button>
              {showBgPicker && <PresetGrid currentId={currentBgId} customBgs={customBgs} onSelect={(id) => { selectBg(id); setShowBgPicker(false) }} onUploadClick={handleUploadClick} onDeleteCustom={handleDeleteCustom} onClose={() => setShowBgPicker(false)} />}
            </div>
            <div ref={sliderRef}>
              {showSettings ? (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5">
                  <span className="text-[9px] font-mono text-white/40">模糊</span>
                  <input type="range" min="0" max="20" step="1" value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="w-14 sm:w-20 h-0.5 accent-accent cursor-pointer" />
                  <span className="text-[9px] font-mono text-white/50 min-w-[14px] text-right">{blur}</span>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); setShowBgPicker(false) }}
                  className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
                  <Settings size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}





