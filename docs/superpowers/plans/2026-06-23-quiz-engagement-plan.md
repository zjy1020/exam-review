# 刷题体验趣味化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 quiz-view 中叠加趣味交互层：连击、动效、粒子、音效、成就、计时、完成成绩卡

**Architecture:** 全部以独立组件/hooks 实现，零侵入现有答题逻辑。quiz-view.tsx 仅导入新组件并传递必要状态。CSS keyframes 集中在 globals.css。

**Tech Stack:** React 19 + TypeScript + Framer Motion + Tailwind CSS 4 + Canvas 2D + Web Audio API

---

### Task 1: CSS 动画 keyframes

**Files:**
- Modify: `app/globals.css`（末尾）

在 globals.css 末尾添加以下动画 keyframes：

```css
/* === 答题趣味动画 === */
@keyframes correct-glow {
  0% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0.4); }
  70% { box-shadow: 0 0 0 8px hsl(var(--accent) / 0); }
  100% { box-shadow: 0 0 0 0 hsl(var(--accent) / 0); }
}
@keyframes wrong-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
@keyframes select-bounce {
  0% { transform: scale(1); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
}
@keyframes streak-pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes confetti-fall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
}
@keyframes encouragement-in {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes encouragement-out {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}
@keyframes aurora-flash {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(180deg) brightness(1.5); }
}

.animate-correct-glow { animation: correct-glow 0.6s ease-out; }
.animate-wrong-shake { animation: wrong-shake 0.3s ease-out; }
.animate-select-bounce { animation: select-bounce 0.15s ease-out; }
.animate-streak-pop { animation: streak-pop 0.3s ease-out; }
.animate-confetti-fall { animation: confetti-fall 1.5s ease-out forwards; }
.animate-encouragement-in { animation: encouragement-in 0.3s ease-out; }
.animate-encouragement-out { animation: encouragement-out 0.3s ease-in forwards; }
.animate-aurora-flash { animation: aurora-flash 0.5s ease-out; }
```

- [ ] **Step 1: 添加 keyframes**

在 globals.css 末尾追加上述代码。确认：

Run: `cd C:\Users\YBY\Desktop\review && type app\globals.css | Select-String -Pattern "@keyframes correct-glow"`

Expected: 应匹配到 `correct-glow`

- [ ] **Step 2: 验证 CSS 语法**

Run: `cd C:\Users\YBY\Desktop\review && npx tailwindcss -i app/globals.css -o /dev/null --dry-run 2>&1`

Expected: 无报错（或 tailwind 正常处理）

- [ ] **Step 3: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add quiz engagement CSS keyframes"
```

---

### Task 2: useStreak hook

**Files:**
- Create: `hooks/use-streak.ts`

- [ ] **Step 1: 创建钩子**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add useStreak hook"
```

---

### Task 3: useSound hook

**Files:**
- Create: `hooks/use-sound.ts`

- [ ] **Step 1: 创建音效 hook（Web Audio API 合成）**

```typescript
"use client"

import { useCallback, useRef, useState, useEffect } from "react"

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem("quiz-sound-muted") === "true" }
    catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem("quiz-sound-muted", muted ? "true" : "false") }
    catch { /* ignore */ }
  }, [muted])

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = "sine") => {
    if (muted) return
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch { /* ignore */ }
  }, [muted, getCtx])

  const playCorrect = useCallback(() => playTone(880, 0.15), [playTone])
  const playWrong = useCallback(() => playTone(220, 0.25, "square"), [playTone])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  return { playCorrect, playWrong, muted, toggleMute }
}
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add useSound hook with Web Audio API"
```

---

### Task 4: 成就系统

**Files:**
- Create: `lib/achievements.ts`
- Create: `hooks/use-achievements.ts`

- [ ] **Step 1: 成就定义 + 存储**

```typescript
// lib/achievements.ts

export interface Achievement {
  id: string
  name: string
  icon: string
  condition: (stats: AchievementStats) => boolean
}

export interface AchievementStats {
  totalCorrect: number
  maxStreak: number
  subjectCompleted: boolean
  wrongBookCleared: boolean
  fastAnswerCount: number
  totalAnswered: number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_perfect", name: "初露锋芒", icon: "⭐", condition: (s) => s.totalCorrect >= 10 },
  { id: "streak_10", name: "势如破竹", icon: "🔥", condition: (s) => s.maxStreak >= 10 },
  { id: "streak_20", name: "无人能挡", icon: "💥", condition: (s) => s.maxStreak >= 20 },
  { id: "complete_subject", name: "学有所成", icon: "🎓", condition: (s) => s.subjectCompleted },
  { id: "wrong_book_clear", name: "知错就改", icon: "📖", condition: (s) => s.wrongBookCleared },
  { id: "fast_learner", name: "闪电侠", icon: "⚡", condition: (s) => s.fastAnswerCount >= 3 },
]

export function loadUnlocked(): string[] {
  try {
    const raw = localStorage.getItem("quiz-achievements")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveUnlocked(ids: string[]) {
  try { localStorage.setItem("quiz-achievements", JSON.stringify(ids)) }
  catch { /* ignore */ }
}
```

- [ ] **Step 2: 成就 hook**

```typescript
// hooks/use-achievements.ts
"use client"

import { useState, useCallback } from "react"
import { ACHIEVEMENTS, loadUnlocked, saveUnlocked, type AchievementStats } from "@/lib/achievements"

export function useAchievements() {
  const [unlocked, setUnlocked] = useState<string[]>(loadUnlocked)
  const [newUnlocks, setNewUnlocks] = useState<string[]>([])

  const checkAchievements = useCallback((stats: AchievementStats) => {
    const newOnes = ACHIEVEMENTS
      .filter((a) => !unlocked.includes(a.id) && a.condition(stats))
      .map((a) => a.id)

    if (newOnes.length > 0) {
      const updated = [...unlocked, ...newOnes]
      setUnlocked(updated)
      saveUnlocked(updated)
      setNewUnlocks(newOnes)
    }
  }, [unlocked])

  const clearNewUnlocks = useCallback(() => setNewUnlocks([]), [])

  const unlockedDetails = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id))
  const lockedDetails = ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id))

  return { unlocked, newUnlocks, unlockedDetails, lockedDetails, checkAchievements, clearNewUnlocks }
}
```

- [ ] **Step 3: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add achievement system"
```

---

### Task 5: QuizStreak 组件

**Files:**
- Create: `components/quiz-streak.tsx`

- [ ] **Step 1: 创建连击显示组件**

```typescript
"use client"

import { motion, AnimatePresence } from "framer-motion"

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
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizStreak component"
```

---

### Task 6: QuizEncouragement 组件

**Files:**
- Create: `components/quiz-encouragement.tsx`

- [ ] **Step 1: 创建鼓励语录组件**

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
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
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizEncouragement component"
```

---

### Task 7: QuizParticles 背景粒子

**Files:**
- Create: `components/quiz-particles.tsx`

- [ ] **Step 1: 创建 Canvas 粒子组件**

```typescript
"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

export function QuizParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    // Create particles
    const count = 40
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.05,
    }))

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(var(--accent) / ${p.opacity})`
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  )
}
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizParticles background"
```

---

### Task 8: QuizSoundToggle 组件

**Files:**
- Create: `components/quiz-sound-toggle.tsx`

- [ ] **Step 1: 创建音效开关按钮**

```typescript
"use client"

import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuizSoundToggleProps {
  muted: boolean
  onToggle: () => void
}

export function QuizSoundToggle({ muted, onToggle }: QuizSoundToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="text-xs font-mono gap-1 text-muted-foreground hover:text-foreground"
      title={muted ? "开启音效" : "关闭音效"}
    >
      {muted ? <VolumeX size={14} strokeWidth={1.5} /> : <Volume2 size={14} strokeWidth={1.5} />}
      <span className="hidden sm:inline text-[10px]">{muted ? "音效关" : "音效开"}</span>
    </Button>
  )
}
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizSoundToggle component"
```

---

### Task 9: QuizTimer 计时组件

**Files:**
- Create: `components/quiz-timer.tsx`

- [ ] **Step 1: 创建答题计时器**

```typescript
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
        <span className={`text-xs font-mono font-bold tabular-nums ${urgent ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
          {timeLeft}s
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizTimer component"
```

---

### Task 10: QuizCelebration 撒花 + 里程碑

**Files:**
- Create: `components/quiz-celebration.tsx`

- [ ] **Step 1: 创建庆祝动画组件**

```typescript
"use client"

import { useEffect, useState, useRef } from "react"
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
              transition={{ duration: 1.5 + p.delay, ease: "ease-in" }}
              className="absolute top-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: p.color, left: `${p.x}%`, delay: p.delay }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: add QuizCelebration confetti component"
```

---

### Task 11: 增强完成成绩卡

**Files:**
- Modify: `components/quiz-view.tsx`（isFinished 分支，约 `line 562-640`）

- [ ] **Step 1: 替换完成页面**

将 `if (isFinished) { ... }` 块替换为增强版成绩卡，包含：
- 正确率环图（使用 recharts PieChart）
- 最高连击显示
- 按章节统计的迷你条形图
- 成就解锁展示
- 动态评语文案

注意：需要从外部传入 `maxStreak`、`unlockedDetails`、`newUnlocks`、章节统计数据

具体替换后的代码展示（仅关键部分）：

```tsx
if (isFinished) {
  const rate = displayQuestions.length > 0
    ? Math.round((totalCorrect / displayQuestions.length) * 100)
    : 0
  const verdict = rate === 100 ? "满分！你是天才吗？"
    : rate >= 80 ? "优秀！掌握得很好"
    : rate >= 60 ? "还不错，再巩固一下"
    : "继续加油，多练几次"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto px-4"
    >
      <div className="glass-card p-6 lg:p-10 rounded-xl text-center">
        <h2 className="font-pixel text-xl sm:text-2xl text-foreground mb-2">
          {mode === "wrong-book" ? "错题本答题完成" : "答题完成"}
        </h2>
        <p className="text-xs font-mono text-muted-foreground mb-6">{verdict}</p>

        {/* 正确率环图 */}
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28">
            <RechartsPieChart width={112} height={112}>
              <Pie
                data={[
                  { name: "正确", value: totalCorrect, fill: "hsl(var(--accent))" },
                  { name: "错误", value: displayQuestions.length - totalCorrect, fill: "hsl(var(--muted))" },
                ]}
                cx={56} cy={56} innerRadius={38} outerRadius={50}
                startAngle={90} endAngle={-270}
                dataKey="value"
                isAnimationActive={false}
              />
            </RechartsPieChart>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-lg font-mono font-bold text-foreground">{rate}%</span>
              <span className="text-[8px] font-mono text-muted-foreground">正确率</span>
            </div>
          </div>
        </div>

        {/* 数据行 */}
        <div className="flex justify-center gap-6 mb-6 text-xs font-mono">
          <div>
            <span className="text-foreground font-bold">{totalCorrect}</span>
            <span className="text-muted-foreground ml-1">正确</span>
          </div>
          <div className="w-px bg-border/40" />
          <div>
            <span className="text-foreground font-bold">{displayQuestions.length - totalCorrect}</span>
            <span className="text-muted-foreground ml-1">错误</span>
          </div>
          <div className="w-px bg-border/40" />
          <div>
            <span className="text-accent font-bold">{maxStreak}</span>
            <span className="text-muted-foreground ml-1">最高连击</span>
          </div>
        </div>

        {/* 章节强弱项 */}
        {chaptersMap.size > 1 && (
          <div className="mb-6 text-left">
            <div className="text-[10px] font-mono text-muted-foreground mb-2">章节正确率</div>
            {Array.from(chaptersMap.entries()).map(([ch, chQs]) => {
              const chCorrect = chQs.filter((q) => submittedIds.has(q.id) && matchAnswer(answers[q.id], q.answer)).length
              const chRate = chQs.length > 0 ? Math.round((chCorrect / chQs.filter((q) => submittedIds.has(q.id)).length) * 100) : 0
              const answered = chQs.filter((q) => submittedIds.has(q.id)).length
              if (answered === 0) return null
              return (
                <div key={ch} className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono w-16 truncate text-muted-foreground">{ch}</span>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${chRate}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{chRate}%</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 成就解锁 */}
        {newUnlocks.length > 0 && (
          <div className="mb-6">
            <div className="text-[10px] font-mono text-accent mb-2">🎉 新成就解锁！</div>
            <div className="flex justify-center gap-3">
              {newUnlocks.map((id) => {
                const a = ACHIEVEMENTS.find((a) => a.id === id)
                if (!a) return null
                return (
                  <div key={id} className="flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-md border border-accent/20">
                    <span>{a.icon}</span>
                    <span className="text-[10px] font-mono text-accent font-bold">{a.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {/* ... 保持现有按钮不变 ... */}
      </div>
    </motion.div>
  )
}
```

**注意：** 需要在文件顶部添加：
```typescript
import { PieChart as RechartsPieChart, Pie } from "recharts"
import { ACHIEVEMENTS } from "@/lib/achievements"
```

- [ ] **Step 2: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: enhance result card with chart, streaks, chapter stats, achievements"
```

---

### Task 12: 集成所有组件到 quiz-view.tsx

**Files:**
- Modify: `components/quiz-view.tsx`

在 QuizView 组件函数中集成所有新组件和 hooks：

1. 导入新组件和 hooks
2. 初始化 hooks
3. 在 submit handlers 中调用 `onAnswer`、`playCorrect`/`playWrong`
4. 在 UI 中放置组件

- [ ] **Step 1: 添加导入**

```typescript
import { QuizStreak } from "@/components/quiz-streak"
import { QuizEncouragement } from "@/components/quiz-encouragement"
import { QuizSoundToggle } from "@/components/quiz-sound-toggle"
import { QuizParticles } from "@/components/quiz-particles"
import { QuizTimer } from "@/components/quiz-timer"
import { QuizCelebration } from "@/components/quiz-celebration"
import { useStreak } from "@/hooks/use-streak"
import { useSound } from "@/hooks/use-sound"
import { useAchievements } from "@/hooks/use-achievements"
```

- [ ] **Step 2: 初始化 hooks（跟在现有 useState 之后）**

```typescript
const { streak, onAnswer, resetStreak, hasMilestoneTriggered } = useStreak()
const { playCorrect, playWrong, muted, toggleMute } = useSound()
const { newUnlocks, checkAchievements, clearNewUnlocks, unlockedDetails } = useAchievements()
const [timerEnabled, setTimerEnabled] = useState(false)
const [celebrationTrigger, setCelebrationTrigger] = useState<{ triggered: boolean; type: "milestone" | "confetti" | "complete" }>({ triggered: false, type: "milestone" })
const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
const [correctGlow, setCorrectGlow] = useState(false)
const [wrongShake, setWrongShake] = useState(false)
```

- [ ] **Step 3: 修改 submit handlers**

在 `handleMultiSubmit`、`handleTextSubmit`、`handleSubmit` 中，在判断正确/错误后添加：

```typescript
const isCorrect = matchAnswer(...)  // 或对应的判断
onAnswer(isCorrect)
if (isCorrect) {
  playCorrect()
  setCorrectGlow(true)
  setTimeout(() => setCorrectGlow(false), 600)
} else {
  playWrong()
  setWrongShake(true)
  setTimeout(() => setWrongShake(false), 300)
}
setLastCorrect(isCorrect)
```

- [ ] **Step 4: 修改 handleFinish**

```typescript
const handleFinish = () => {
  setIsFinished(true)
  setCelebrationTrigger({ triggered: true, type: "complete" })
  checkAchievements({
    totalCorrect,
    maxStreak: streak.max,
    subjectCompleted: true,
    wrongBookCleared: wrongIds.length === 0,
    fastAnswerCount: 0,
    totalAnswered: submittedIds.size,
  })
}
```

- [ ] **Step 5: 添加里程碑监听**

```typescript
// 里程碑监听
useEffect(() => {
  if (displayQuestions.length === 0) return
  const pct = Math.round((submittedIds.size / displayQuestions.length) * 100)
  if ([25, 50, 75, 100].includes(pct) && !hasMilestoneTriggered(pct)) {
    setCelebrationTrigger({ triggered: true, type: pct === 100 ? "confetti" : "milestone" })
  }
}, [submittedIds.size, displayQuestions.length])
```

- [ ] **Step 6: 在 UI 中放置组件**

在答题主区域的布局中添加：

```tsx
{/* 顶部工具栏 */}
<div className="flex items-center justify-between mb-4 shrink-0">
  <div className="flex items-center gap-2">
    <QuizStreak streak={streak.current} maxStreak={streak.max} focusMode={focusMode} />
    {/* 现有计数器 */}
  </div>
  <div className="flex items-center gap-2">
    <QuizTimer
      enabled={timerEnabled}
      onToggle={() => setTimerEnabled(!timerEnabled)}
      onTimeUp={handleTimerTimeUp}
      isSubmitted={isSubmitted}
      key_={currentIndex}
    />
    <QuizSoundToggle muted={muted} onToggle={toggleMute} />
    {/* 现有按钮 */}
  </div>
</div>

{/* 鼓励语录 */}
<QuizEncouragement streak={streak.current} lastCorrect={lastCorrect} />

{/* 粒子背景 */}
{focusMode && <QuizParticles />}

{/* 庆祝动画 */}
<QuizCelebration triggered={celebrationTrigger.triggered} type={celebrationTrigger.type} />
```

添加 `handleTimerTimeUp` 函数：

```typescript
const handleTimerTimeUp = useCallback(() => {
  if (!current || isSubmitted) return
  if (qType === "input" || qType === "essay") {
    handleTextSubmit()
  } else if (qType === "multiple") {
    handleMultiSubmit()
  } else if (selectedAnswer) {
    handleSubmit()
  }
}, [current, isSubmitted, qType, selectedAnswer, handleTextSubmit, handleMultiSubmit, handleSubmit])
```

- [ ] **Step 7: 重置**

在 `handleRestart` 中添加 `resetStreak()` 和 `clearNewUnlocks()`

- [ ] **Step 8: 提交**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "feat: integrate all engagement features into QuizView"
```

---

### Task 13: 验证构建

- [ ] **Step 1: TypeScript 检查**

Run: `cd C:\Users\YBY\Desktop\review && npx tsc --noEmit`

Expected: 无类型错误

- [ ] **Step 2: 构建**

Run: `cd C:\Users\YBY\Desktop\review && npm run build`

Expected: 构建成功

- [ ] **Step 3: 提交最终版本**

```bash
cd C:\Users\YBY\Desktop\review && git add -A && git commit -m "chore: finalize quiz engagement features"
```
