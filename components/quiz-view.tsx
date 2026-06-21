"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, RotateCcw, BookX, CheckCircle2, XCircle, ArrowLeft, ListTree, Filter, MoreHorizontal } from "lucide-react"
import type { Question } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface QuizViewProps {
  questions: Question[]
  onReset: () => void
  onUpdateWrong: (ids: string[]) => void
  onClearWrong: () => void
  onRemoveWrong?: (id: string) => void
  wrongIds: string[]
  initialMode?: "normal" | "wrong-book"
  focusMode?: boolean
  onToggleFocus?: () => void
  filterKey?: number
  subjectId?: string
}

type QuizMode = "normal" | "wrong-book" | "review"

interface QuizProgress {
  currentIndex: number
  answers: Record<string, string>
  submittedIds: string[]
  quizMode: "sequential" | "shuffled"
  shuffledQuestions: Question[] | null
  selectedChapters: string[]
  selectedTypes: string[]
  isFinished: boolean
}

function getProgressKey(subjectId: string) {
  return `quiz-progress-${subjectId}`
}

function saveProgress(subjectId: string, state: QuizProgress) {
  try {
    localStorage.setItem(getProgressKey(subjectId), JSON.stringify(state))
  } catch { /* quota exceeded, silently ignore */ }
}

function loadProgress(subjectId: string): QuizProgress | null {
  try {
    const raw = localStorage.getItem(getProgressKey(subjectId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearProgress(subjectId: string) {
  try { localStorage.removeItem(getProgressKey(subjectId)) } catch { /* ignore */ }
}

function isTrueFalse(q: Question) {
  // Check by options: "A. 对" / "B. 错"
  if (q.options.length === 2) {
    const opts = q.options.map(o => o.replace(/^[A-Da-d][.、）)\s．]\s*/, '').trim())
    if (opts.every(o => o === "对" || o === "错" || o === "正确" || o === "错误")) return true
  }
  // Check by answer content
  if (q.answer) {
    let ans = q.answer.replace(/[.。\s]/g, "")
    ans = ans.replace(/^[A-Da-d]/, '') // "B错" → "错"
    if (ans === "对" || ans === "错") return true
  }
  return false
}

// Normalize answer for fuzzy matching
function matchAnswer(userAnswer: string | undefined, correctAnswer: string | undefined): boolean {
  if (!userAnswer || !correctAnswer) return false
  const normalize = (s: string) => {
    let r = s.trim()
    r = r.replace(/[（(].*?[）)]/g, '').trim()         // "多态（或Polymorphism）" → "多态"
    r = r.replace(/^[A-Da-d][.、．）)\s]\s*/, '')     // "A. 多态" → "多态"
    if (r === '对' || r === '正确') return 'TRUE'
    if (r === '错' || r === '错误') return 'FALSE'
    r = r.replace(/[.。\s]+$/, '').trim()
    return r
  }
  const a = normalize(userAnswer)
  const b = normalize(correctAnswer)
  if (a === b) return true
  // Check prefix before parentheses
  const base = correctAnswer.replace(/[（(].*$/, '').trim().replace(/[.。\s]+$/, '')
  if (normalize(userAnswer) === normalize(base)) return true
  // Check alternatives inside parentheses: "模块（或单元）" → "单元", "JDK（动态代理，或CGLIB）" → "动态代理"|"CGLIB"
  const inside = correctAnswer.match(/[（(]\s*或?\s*([^）)]*?)\s*[）)]/)
  if (inside) {
    const alts = inside[1].split(/、|，|\s*或\s*/).map((s) => s.trim()).filter(Boolean)
    if (alts.some((alt) => normalize(userAnswer) === normalize(alt))) return true
  }
  return false
}

function getQuestionType(q: Question): "choice" | "truefalse" | "input" | "essay" | "multiple" {
  if (q.type === "choice" || q.type === "truefalse" || q.type === "input" || q.type === "essay" || q.type === "multiple") return q.type
  if (isTrueFalse(q)) return "truefalse"
  if (q.options.length > 0) {
    // Auto-detect multi-choice: answer has 2+ distinct letters
    if (q.answer) {
      // If answer was resolved to option text like "C. xxx", it's single-choice
      if (/^[A-Da-d][.、）)\s．]/.test(q.answer)) return "choice"
      const letters = q.answer.replace(/[^A-Da-d]/g, '').replace(/[.。\s]/g, '')
      const unique = new Set(letters.toUpperCase())
      if (unique.size >= 2) return "multiple"
    }
    return "choice"
  }
  if (q.answer) {
    if (q.answer.length > 12) return "essay"
    if (/[，；、]/.test(q.answer)) return "essay"
  }
  return "input"
}

export function QuizView({ questions, onReset, onUpdateWrong, onClearWrong, onRemoveWrong, wrongIds, initialMode, focusMode, onToggleFocus, filterKey, subjectId }: QuizViewProps) {
  const [mode, setMode] = useState<QuizMode>(initialMode || "normal")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const [isFinished, setIsFinished] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const [showOutline, setShowOutline] = useState(false)
  const [quizMode, setQuizMode] = useState<"sequential" | "shuffled">("sequential")
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[] | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<("choice" | "truefalse" | "input" | "essay" | "multiple")[]>([])
  const [showFilter, setShowFilter] = useState(false)
  const savedFilterIndexRef = useRef<number | null>(null)
  const returningFromEmptyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef<string | null>(null)
  const isRestoringRef = useRef(false)

  // Block horizontal edge swipes that trigger Android WebView back/forward
  const touchStartXRef = useRef<number | null>(null)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }, [])
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartXRef.current === null) return
    const dx = e.touches[0].clientX - touchStartXRef.current
    // If swiping right from left edge (within 40px) or swiping left from right edge
    if (dx > 0 && touchStartXRef.current < 40) {
      e.preventDefault()
    } else if (dx < 0 && touchStartXRef.current > window.innerWidth - 40) {
      e.preventDefault()
    }
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, [handleTouchStart, handleTouchMove])

  // Reset shuffle when questions change
  useEffect(() => {
    setShuffledQuestions(null)
    setQuizMode("sequential")
    setSelectedChapters([])
    setSelectedTypes([])
  }, [questions])

  // Reset filters when re-entering quiz from import (filterKey changes)
  useEffect(() => {
    setSelectedChapters([])
    setSelectedTypes([])
  }, [filterKey])

  // Reset shuffle + position when filters change (skip during restore)
  useEffect(() => {
    if (returningFromEmptyRef.current) {
      returningFromEmptyRef.current = false
      return
    }
    setShuffledQuestions(null)
    setQuizMode("sequential")
    setCurrentIndex(0)
  }, [selectedChapters, selectedTypes])

  // Reset state when questions change (e.g. subject switch)
  useEffect(() => {
    setCurrentIndex(0)
    setAnswers({})
    setSubmittedIds(new Set())
    setIsFinished(false)
    resetInputs()
  }, [questions])

  // Auto-exit wrong-book mode when wrongIds becomes empty
  useEffect(() => {
    if (mode === "wrong-book" && wrongIds.length === 0) {
      setMode("normal")
      setCurrentIndex(0)
      resetInputs()
    }
  }, [wrongIds])

  const activeQuestions = mode === "wrong-book"
    ? questions.filter((q) => wrongIds.includes(q.id))
    : questions

  // Available chapters (from unfiltered set for the filter dialog)
  const allChapters = Array.from(new Set(activeQuestions.map((q) => q.chapter || "未分类")))

  // Apply chapter + type filters
  const filteredQuestions = activeQuestions.filter((q) => {
    if (selectedChapters.length > 0) {
      const ch = q.chapter || "未分类"
      if (!selectedChapters.includes(ch)) return false
    }
    if (selectedTypes.length > 0) {
      if (!selectedTypes.includes(getQuestionType(q))) return false
    }
    return true
  })

  const displayQuestions = quizMode === "shuffled" && shuffledQuestions ? shuffledQuestions : filteredQuestions

  const current = displayQuestions[currentIndex]

  // Restore progress from localStorage on mount / subject switch
  useEffect(() => {
    if (!subjectId || questions.length === 0 || mode === "review") return
    if (restoredRef.current === subjectId) return

    isRestoringRef.current = true
    const saved = loadProgress(subjectId)
    if (saved) {
      setAnswers(saved.answers)
      setSubmittedIds(new Set(saved.submittedIds))
      setQuizMode(saved.quizMode)
      if (saved.shuffledQuestions) setShuffledQuestions(saved.shuffledQuestions)
      // Set filters + index + finished last, suppressing the filter-change reset
      returningFromEmptyRef.current = true
      setSelectedChapters(saved.selectedChapters)
      setSelectedTypes(saved.selectedTypes)
      setCurrentIndex(saved.currentIndex)
      if (saved.isFinished) setIsFinished(true)
    }
    restoredRef.current = subjectId
    // Reset restoring flag after save effect has had a chance to check it
    requestAnimationFrame(() => { isRestoringRef.current = false })
  }, [subjectId, questions])

  // Save progress to localStorage on every relevant state change
  useEffect(() => {
    if (!subjectId || questions.length === 0 || mode === "review" || isRestoringRef.current) return
    const progress: QuizProgress = {
      currentIndex,
      answers,
      submittedIds: Array.from(submittedIds),
      quizMode,
      shuffledQuestions,
      selectedChapters,
      selectedTypes,
      isFinished,
    }
    saveProgress(subjectId, progress)
  }, [subjectId, currentIndex, answers, submittedIds, quizMode, shuffledQuestions, selectedChapters, selectedTypes, isFinished])

  // Initialize multiSelected when switching to an answered multi question
  useEffect(() => {
    if (current && getQuestionType(current) === "multiple" && submittedIds.has(current.id)) {
      const saved = answers[current.id] || ""
      setMultiSelected(saved ? saved.split('') : [])
    } else {
      setMultiSelected([])
    }
  }, [currentIndex])

  // Prevent Android WebView swipe-back gesture
  useEffect(() => {
    // Push a history state so popstate can be intercepted
    window.history.pushState(null, '', window.location.href)
    const handler = () => {
      // Re-push to stay on page (blocks Android swipe-back)
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const resetInputs = () => {
    setTextInput("")
    setMultiSelected([])
  }

  const shuffleQuestions = () => {
    const arr = [...filteredQuestions]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffledQuestions(arr)
    setQuizMode("shuffled")
    setCurrentIndex(0)
    resetInputs()
  }

  const setSequential = () => {
    setQuizMode("sequential")
    setCurrentIndex(0)
    resetInputs()
  }
  const qType = current ? getQuestionType(current) : "choice"
  const selectedAnswer = answers[current?.id || ""] || ""
  const isSubmitted = submittedIds.has(current?.id || "")

  // Build outline data: group by chapter, then by type
  const chaptersMap = new Map<string, Question[]>()
  for (const q of displayQuestions) {
    const ch = q.chapter || "未分类"
    if (!chaptersMap.has(ch)) chaptersMap.set(ch, [])
    chaptersMap.get(ch)!.push(q)
  }

  const handleSelect = (opt: string) => {
    if (isSubmitted) return
    setAnswers((prev) => ({ ...prev, [current.id]: opt }))
  }

  const handleMultiToggle = (opt: string) => {
    if (isSubmitted) return
    setMultiSelected((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    )
  }

  function normalizeMultiLetters(answer: string): string {
    const letters = answer.replace(/[^A-Da-d]/g, '').toUpperCase().split('').sort()
    return [...new Set(letters)].join('')
  }

  const handleMultiSubmit = () => {
    if (multiSelected.length === 0 || !current) return
    const sorted = normalizeMultiLetters(multiSelected.join(','))
    setAnswers((prev) => ({ ...prev, [current.id]: sorted }))
    const newSubmitted = new Set(submittedIds)
    newSubmitted.add(current.id)
    setSubmittedIds(newSubmitted)
    const correct = normalizeMultiLetters(current.answer || '')
    if (sorted !== correct) {
      if (!wrongIds.includes(current.id)) {
        onUpdateWrong([...wrongIds, current.id])
      }
    }
  }

  const handleTextSubmit = () => {
    if (!textInput.trim() || !current) return
    setAnswers((prev) => ({ ...prev, [current.id]: textInput.trim() }))
    const newSubmitted = new Set(submittedIds)
    newSubmitted.add(current.id)
    setSubmittedIds(newSubmitted)
    if (!matchAnswer(textInput.trim(), current.answer)) {
      if (!wrongIds.includes(current.id)) {
        onUpdateWrong([...wrongIds, current.id])
      }
    }
  }

  const handleSubmit = () => {
    if (!selectedAnswer || !current) return
    const newSubmitted = new Set(submittedIds)
    newSubmitted.add(current.id)
    setSubmittedIds(newSubmitted)

    if (!matchAnswer(selectedAnswer, current.answer)) {
      if (!wrongIds.includes(current.id)) {
        onUpdateWrong([...wrongIds, current.id])
      }
    }
  }

  const goNext = () => {
    if (currentIndex < displayQuestions.length - 1) {
      setCurrentIndex((i) => i + 1)
      resetInputs()
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      resetInputs()
    }
  }

  const handleFinish = () => {
    setIsFinished(true)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setAnswers({})
    setSubmittedIds(new Set())
    setIsFinished(false)
    resetInputs()
    if (subjectId) clearProgress(subjectId)
  }

  const switchMode = (m: QuizMode) => {
    setMode(m)
    setCurrentIndex(0)
    resetInputs()
  }
  const toggleReview = () => {
    if (mode === "review") {
      setMode("normal")
    } else {
      setMode("review")
      setCurrentIndex(0)
    }
    resetInputs()
  }

  const unanswered = displayQuestions.filter((q) => !submittedIds.has(q.id)).length
  const totalCorrect = displayQuestions.filter(
    (q) => submittedIds.has(q.id) && (getQuestionType(q) === "multiple" ? normalizeMultiLetters(answers[q.id] || '') === normalizeMultiLetters(q.answer || '') : matchAnswer(answers[q.id], q.answer))
  ).length

  // Adjust currentIndex when list shrinks (e.g. removing from wrong book)
  useEffect(() => {
    if (currentIndex >= displayQuestions.length && displayQuestions.length > 0) {
      setCurrentIndex(displayQuestions.length - 1)
    }
  }, [displayQuestions.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current || isFinished) return
      const key = e.key

      if (!isSubmitted && qType === "choice" && ["a", "A", "b", "B", "c", "C", "d", "D"].includes(key)) {
        const idx = key.toUpperCase().charCodeAt(0) - 65
        if (current.options[idx]) {
          e.preventDefault()
          handleSelect(current.options[idx])
        }
      }

      if (key === "Enter") {
        if ((qType === "input" || qType === "essay") && !isSubmitted && textInput.trim()) {
          e.preventDefault()
          handleTextSubmit()
        } else if (qType === "multiple" && !isSubmitted && multiSelected.length > 0) {
          e.preventDefault()
          handleMultiSubmit()
        } else if (!isSubmitted && selectedAnswer) {
          e.preventDefault()
          handleSubmit()
        } else if (isSubmitted) {
          e.preventDefault()
          if (currentIndex < displayQuestions.length - 1) {
            goNext()
          } else {
            handleFinish()
          }
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  // Result screen
  if (isFinished) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto px-4 text-center"
      >
        <div className="glass-card p-8 lg:p-12 rounded-xl">
          <h2 className="font-pixel text-2xl sm:text-3xl text-foreground mb-6">
            {mode === "wrong-book" ? "错题本答题完成" : "答题完成"}
          </h2>

          <div className="flex justify-center gap-8 mb-8">
            <div>
              <div className="text-4xl font-mono font-bold text-foreground">
                {totalCorrect}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1">
                正确
              </div>
            </div>
            <div className="w-px bg-foreground/20" />
            <div>
              <div className="text-4xl font-mono font-bold text-foreground">
                {displayQuestions.length - totalCorrect}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1">
                错误
              </div>
            </div>
            <div className="w-px bg-foreground/20" />
            <div>
              <div className="text-4xl font-mono font-bold text-accent">
                {displayQuestions.length > 0
                  ? Math.round((totalCorrect / displayQuestions.length) * 100)
                  : 0}%
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1">
                正确率
              </div>
            </div>
          </div>

          {mode !== "wrong-book" && wrongIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsFinished(false)
                switchMode("wrong-book")
              }}
              className="gap-2 text-xs font-mono mb-4 mx-auto"
            >
              <BookX size={14} strokeWidth={1.5} />
              查看错题本 ({wrongIds.length})
            </Button>
          )}

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              className="gap-2 text-xs font-mono"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              重新答题
            </Button>
            <Button
              onClick={onReset}
              className="gap-2 text-xs font-mono"
            >
              返回首页
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!current) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 text-center py-12">
        <p className="text-xs font-mono text-muted-foreground">
          {mode === "wrong-book" ? "错题本为空" : "暂无题目"}
        </p>
        <Button
          onClick={() => {
            if (mode === "wrong-book" || questions.length === 0) {
              onReset()
            } else {
              returningFromEmptyRef.current = true
              setSelectedChapters([])
              setSelectedTypes([])
              if (savedFilterIndexRef.current !== null) {
                setCurrentIndex(savedFilterIndexRef.current)
                savedFilterIndexRef.current = null
              }
            }
          }}
          className="mt-4 text-xs font-mono"
        >
          返回
        </Button>
      </div>
    )
  }

  // 背题模式 — scrollable review of all questions with answers and explanations
  if (mode === "review") {
    const reviewQuestions = displayQuestions.length > 0 ? displayQuestions : activeQuestions
    return (
      <div ref={containerRef} className={`w-full max-w-4xl mx-auto px-4 h-full flex flex-col min-h-0 ${focusMode ? "pt-[env(safe-area-inset-top)]" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-accent font-bold tracking-wider uppercase">背题模式</span>
            <span className="text-xs font-mono text-muted-foreground">{reviewQuestions.length} 题</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilter(true)}
              className="text-xs font-mono gap-1"
              title="筛选章节和题型"
            >
              <Filter size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">筛选</span>
              {(selectedChapters.length > 0 || selectedTypes.length > 0) && (
                <span className="text-accent font-bold">
                  ({selectedChapters.length || "全"}/{selectedTypes.length || "全"})
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setQuizMode(quizMode === "shuffled" ? "sequential" : "shuffled"); if (quizMode === "shuffled") setSequential(); else shuffleQuestions() }}
              className="text-xs font-mono gap-1"
            >
              {quizMode === "shuffled" ? "顺序" : "打乱"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMode("normal"); setCurrentIndex(0); resetInputs() }}
              className="text-xs font-mono"
            >
              答题
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMode("normal"); onReset() }}
              className="text-xs font-mono"
            >
              退出
            </Button>
          </div>
        </div>

        {/* Scrollable question list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-6 scrollbar-thin">
          {reviewQuestions.map((q, qi) => {
            const qt = getQuestionType(q)
            const optLetter = (i: number) => String.fromCharCode(65 + i)
            // Resolve answer for string answers like "A. xxx" → extract text
            const resolveAnswer = (ans: string): string => {
              const optMatch = q.options.find(o =>
                o.toUpperCase().startsWith(ans.toUpperCase().replace(/[.。\s]/g, '') + '.') ||
                o.toUpperCase().startsWith(ans.toUpperCase().replace(/[.。\s]/g, '') + '、')
              )
              return optMatch || ans
            }
            return (
              <Card key={q.id} className="border-border/40 shadow-sm bg-card/80 backdrop-blur-xl">
                <CardContent className="p-5 lg:p-6">
                  {/* Chapter + type */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {q.chapter && (
                        <span className="text-xs font-mono text-accent uppercase">{q.chapter}</span>
                      )}
                      <Badge variant="outline" className="text-[9px] font-mono tracking-wider border-accent/30 bg-accent/5 text-accent">
                        {qt === "choice" ? "选择题" : qt === "multiple" ? "多选题" : qt === "truefalse" ? "判断题" : qt === "essay" ? "简答题" : "填空题"}
                      </Badge>
                    </div>
                  </div>

                  {/* Question text */}
                  <h3 className="text-sm font-mono text-foreground leading-relaxed mb-4">
                    <span className="text-accent font-bold mr-2">{q.number}.</span>
                    {q.question}
                  </h3>

                  {/* Options */}
                  {q.options.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt, i) => {
                        const letter = optLetter(i)
                        const isCorrect = qt === "multiple"
                          ? normalizeMultiLetters(q.answer).includes(letter)
                          : opt === (() => {
                              if (/^[A-Da-d][.、）)\s．]/.test(q.answer)) return q.answer
                              if (q.answer && q.answer.length === 1 && /^[A-Da-d]$/.test(q.answer)) {
                                return q.options.find(o => o.toUpperCase().startsWith(q.answer!.toUpperCase() + '.')) || q.answer
                              }
                              return q.answer || ''
                            })()
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2.5 text-xs font-mono leading-relaxed rounded-lg border ${
                              isCorrect
                                ? "border-accent/60 bg-accent/10 text-foreground"
                                : "border-transparent text-muted-foreground"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isCorrect && <CheckCircle2 size={12} className="shrink-0 text-accent" />}
                              {opt}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Answer */}
                  {q.answer && (
                    <div className="mb-3 px-3 py-2 text-xs font-mono border border-accent/30 bg-accent/[0.07] rounded-lg">
                      <span className="text-accent font-bold">答案：</span>
                      <span className="text-foreground">{qt === "multiple" ? normalizeMultiLetters(q.answer) : q.answer}</span>
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="px-3 py-2.5 border border-border/40 bg-background/50 rounded-lg">
                      <span className="text-[10px] font-mono text-accent font-bold tracking-wider uppercase block mb-1">
                        解析
                      </span>
                      <p className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filter dialog */}
        <Dialog open={showFilter} onOpenChange={(open) => { setShowFilter(open); if (open) savedFilterIndexRef.current = null }}>
          <DialogContent className="glass-dialog max-w-sm max-h-[80vh] overflow-y-auto rounded-xl">
            <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
              筛选设置
            </DialogTitle>

            {/* Type filters */}
            <div className="mt-3">
              <div className="text-xs font-mono text-muted-foreground mb-2">按题型</div>
              <div className="flex gap-2">
                {(["choice", "multiple", "truefalse", "input", "essay"] as const).map((t) => {
                  const label = t === "choice" ? "选择题" : t === "multiple" ? "多选题" : t === "truefalse" ? "判断题" : t === "essay" ? "简答题" : "填空题"
                  const active = selectedTypes.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = 0
                        setSelectedTypes((prev) =>
                          active ? prev.filter((x) => x !== t) : [...prev, t]
                        )
                      }}
                      className={`flex-1 px-2 py-1.5 text-xs font-mono border transition-colors rounded-md ${
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/30"
                      }`}
                    >
                      {active ? "✓ " : ""}{label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Chapter filters */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">按章节</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = 0
                      setSelectedChapters(allChapters)
                    }}
                    className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => {
                      if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = 0
                      setSelectedChapters([])
                    }}
                    className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
              <div className="space-y-1 max-h-[250px] overflow-y-auto">
                {allChapters.map((ch) => {
                  const active = selectedChapters.includes(ch)
                  return (
                    <button
                      key={ch}
                      onClick={() => {
                        if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = 0
                        setSelectedChapters((prev) =>
                          active ? prev.filter((x) => x !== ch) : [...prev, ch]
                        )
                      }}
                      className={`w-full text-left px-2 py-1 text-xs font-mono border transition-colors rounded-md ${
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                      }`}
                    >
                      {active ? "✓ " : "  "}{ch}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Info */}
            <div className="mt-3 text-xs font-mono text-muted-foreground">
              {filteredQuestions.length} 题（共 {activeQuestions.length} 题）
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`w-full max-w-4xl mx-auto px-4 h-full flex flex-col min-h-0 overscroll-x-none touch-pan-y ${focusMode ? "pt-[env(safe-area-inset-top)]" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          {mode === "wrong-book" ? (
            <Button variant="link" size="sm" onClick={() => switchMode("normal")} className="gap-1 text-xs font-mono text-accent p-0 h-auto">
              <ArrowLeft size={14} strokeWidth={1.5} />
              返回答题
            </Button>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">答题</span>
          )}
          {mode === "wrong-book" && (
            <span className="text-xs font-mono text-muted-foreground">错题本</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {mode === "wrong-book" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("清空错题本？")) {
                  onClearWrong()
                }
              }}
              className="text-xs font-mono text-muted-foreground hover:text-destructive"
            >
              清空错题本
            </Button>
          )}

          {/* Desktop: all buttons visible */}
          <div className="hidden lg:flex items-center gap-1">
            {mode !== "wrong-book" && mode !== "review" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilter(true)}
                className="text-xs font-mono gap-1"
                title="筛选章节和题型"
              >
                <Filter size={14} strokeWidth={1.5} />
                筛选
                {(selectedChapters.length > 0 || selectedTypes.length > 0) && (
                  <span className="text-accent font-bold">
                    ({selectedChapters.length || "全"}/{selectedTypes.length || "全"})
                  </span>
                )}
              </Button>
            )}
            {mode !== "wrong-book" && mode !== "review" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={quizMode === "shuffled" ? setSequential : shuffleQuestions}
                className="text-xs font-mono gap-1"
                title={quizMode === "shuffled" ? "顺序答题" : "打乱顺序"}
              >
                <span className={quizMode === "shuffled" ? "text-accent" : ""}>
                  {quizMode === "shuffled" ? "打乱中" : "打乱顺序"}
                </span>
              </Button>
            )}
            {onToggleFocus && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFocus}
                className="text-xs font-mono"
                title={focusMode ? "退出专注模式" : "专注答题模式"}
              >
                {focusMode ? "退出专注" : "专注答题"}
              </Button>
            )}
            {mode !== "wrong-book" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleReview}
                className="text-xs font-mono gap-1"
                title="背题模式"
              >
                {mode === "review" ? "退出背题" : "背题模式"}
              </Button>
            )}
          </div>

          {/* Mobile: 背题 / outline / restart / exit */}
          {mode !== "wrong-book" && (
            <Button
              variant={mode === "review" ? "default" : "ghost"}
              size="sm"
              onClick={toggleReview}
              className="lg:hidden text-xs font-mono gap-1"
            >
              {mode === "review" ? "退出背题" : "背题模式"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOutline(true)}
            className="text-xs font-mono gap-1"
          >
            <ListTree size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline">大纲</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestart}
            className="text-xs font-mono"
          >
            重新开始
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs font-mono"
          >
            退出
          </Button>

          {/* Mobile more dropdown */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-mono">
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-dialog min-w-[160px] rounded-xl border-border/40">
                {mode !== "wrong-book" && (
                  <>
                    <DropdownMenuItem onClick={() => setShowFilter(true)} className="text-xs font-mono gap-2 cursor-pointer">
                      <Filter size={12} strokeWidth={1.5} />
                      筛选
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={quizMode === "shuffled" ? setSequential : shuffleQuestions} className="text-xs font-mono gap-2 cursor-pointer">
                      {quizMode === "shuffled" ? "顺序答题" : "打乱顺序"}
                    </DropdownMenuItem>
                  </>
                )}
                {onToggleFocus && (
                  <DropdownMenuItem onClick={onToggleFocus} className="text-xs font-mono gap-2 cursor-pointer">
                    {focusMode ? "退出专注" : "专注答题"}
                  </DropdownMenuItem>
                )}
                {mode !== "wrong-book" && (
                  <DropdownMenuItem onClick={toggleReview} className="text-xs font-mono gap-2 cursor-pointer">
                    {mode === "review" ? "退出背题" : "背题模式"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 shrink-0">
        <Progress value={((currentIndex + 1) / displayQuestions.length) * 100} className="h-1.5 bg-muted/50" />
      </div>

      {/* Question counter & type badge */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="text-xs font-mono text-muted-foreground">
          {currentIndex + 1} / {displayQuestions.length}
          <span className="ml-2">| 未答 {unanswered} 题</span>
        </div>
        <Badge variant="outline" className="text-xs font-mono tracking-wider border-accent/30 bg-accent/5 text-accent hover:bg-accent/10">
          {qType === "choice" ? "选择题" : qType === "multiple" ? "多选题" : qType === "truefalse" ? "判断题" : qType === "essay" ? "简答题" : "填空题"}
        </Badge>
      </div>

      {/* Question card */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin" style={{ scrollbarGutter: "stable" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="mb-4 border-border/40 shadow-sm bg-card/80 backdrop-blur-xl">
          <CardContent className="p-5 lg:p-6">
          {/* Chapter badge row */}
          <div className="flex items-center justify-between mb-2">
            {current.chapter ? (
              <div className="text-xs font-mono text-accent tracking-wider uppercase">
                {current.chapter}
              </div>
            ) : (
              <div />
            )}
            {mode === "wrong-book" && onRemoveWrong && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveWrong(current.id)}
                className="text-xs font-mono text-muted-foreground hover:text-destructive"
              >
                ✕ 移出错题本
              </Button>
            )}
          </div>

          {/* Question text */}
          <h3 className="text-sm font-mono text-foreground leading-relaxed mb-5">
            <span className="text-accent font-bold mr-2">{current.number}.</span>
            {current.question}
          </h3>

          {/* Result badge */}
          {isSubmitted && (
            <div className={`mb-4 rounded-lg overflow-hidden border ${
              (() => {
                if (qType === "multiple") return normalizeMultiLetters(selectedAnswer) === normalizeMultiLetters(current.answer) ? "border-accent/60" : "border-destructive/60"
                return matchAnswer(selectedAnswer, current.answer) ? "border-accent/60" : "border-destructive/60"
              })()
            }`}>
              <div className={`px-4 py-3 text-sm font-mono font-bold tracking-wider uppercase flex items-center gap-2 ${
                (() => {
                  if (qType === "multiple") return normalizeMultiLetters(selectedAnswer) === normalizeMultiLetters(current.answer) ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                  return matchAnswer(selectedAnswer, current.answer) ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                })()
              }`}>
                {(qType === "multiple" ? normalizeMultiLetters(selectedAnswer) === normalizeMultiLetters(current.answer) : matchAnswer(selectedAnswer, current.answer)) ? (
                  <><CheckCircle2 size={16} className="shrink-0" /> 正确</>
                ) : (
                  <><XCircle size={16} className="shrink-0" /> 错误</>
                )}
              </div>
              {selectedAnswer !== current.answer && (qType !== "multiple" ? true : normalizeMultiLetters(selectedAnswer) !== normalizeMultiLetters(current.answer)) && (
                <div className="px-4 py-3 space-y-1.5 bg-background/50">
                  <div className="text-xs font-mono">
                    <span className="text-muted-foreground">你的答案：</span>
                    <span className="text-destructive font-bold">{qType === "multiple" ? selectedAnswer : selectedAnswer}</span>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="text-muted-foreground">正确答案：</span>
                    <span className="text-accent font-bold">{qType === "multiple" ? normalizeMultiLetters(current.answer) : current.answer}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Answer input area */}
          {qType === "choice" && (
            <div className="space-y-2">
              {current.options.map((opt, i) => {
                const isSelected = selectedAnswer === opt
                const isAnswer = isSubmitted && opt === current.answer
                const isWrong = isSubmitted && isSelected && opt !== current.answer

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt)}
                    disabled={isSubmitted}
                    className={`w-full text-left px-3 py-3 text-xs font-mono leading-relaxed transition-all rounded-lg border ${
                      isSubmitted
                        ? isAnswer
                          ? "border-accent/60 bg-accent/10 text-foreground"
                          : isWrong
                          ? "border-destructive/60 bg-destructive/10 text-foreground"
                          : "border-transparent text-muted-foreground"
                        : isSelected
                        ? "border-accent/40 bg-accent/8 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSubmitted && isAnswer && (
                        <CheckCircle2 size={12} className="shrink-0 text-accent" />
                      )}
                      {isSubmitted && isWrong && (
                        <XCircle size={12} className="shrink-0 text-destructive" />
                      )}
                      {opt}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {qType === "multiple" && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                {multiSelected.length} 个已选（可多选）
              </div>
              {current.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i)
                const isSelected = multiSelected.includes(letter)
                const isCorrect = isSubmitted && normalizeMultiLetters(current.answer).includes(letter)
                const isWrong = isSubmitted && isSelected && !normalizeMultiLetters(current.answer).includes(letter)

                return (
                  <button
                    key={i}
                    onClick={() => handleMultiToggle(letter)}
                    disabled={isSubmitted}
                    className={`w-full text-left px-3 py-3 text-xs font-mono leading-relaxed transition-all rounded-lg border ${
                      isSubmitted
                        ? isCorrect
                          ? "border-accent/60 bg-accent/10 text-foreground"
                          : isWrong
                          ? "border-destructive/60 bg-destructive/10 text-foreground"
                          : "border-transparent text-muted-foreground"
                        : isSelected
                        ? "border-accent/40 bg-accent/8 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-mono transition-colors ${
                        isSubmitted
                          ? isCorrect
                            ? "border-accent bg-accent/20 text-accent"
                            : isWrong
                            ? "border-destructive bg-destructive/20 text-destructive"
                            : "border-border/40"
                          : isSelected
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-border/40"
                      }`}>
                        {isSelected || (isSubmitted && isCorrect) ? "✓" : ""}
                      </span>
                      {opt}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {qType === "truefalse" && (
            <div className="flex gap-3">
              {["对", "错"].map((val) => {
                const isSelected = selectedAnswer === val
                const isAnswer = isSubmitted && val === current.answer
                const isWrong = isSubmitted && isSelected && val !== current.answer

                return (
                  <button
                    key={val}
                    onClick={() => handleSelect(val)}
                    disabled={isSubmitted}
                    className={`flex-1 px-4 py-3 text-sm font-mono font-bold transition-all rounded-lg border ${
                      isSubmitted
                        ? isAnswer
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : isWrong
                          ? "border-destructive/60 bg-destructive/10 text-destructive"
                          : "border-transparent text-muted-foreground"
                        : isSelected
                        ? "border-accent/40 bg-accent/8 text-accent"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSubmitted && isAnswer && (
                        <CheckCircle2 size={14} className="text-accent" />
                      )}
                      {isSubmitted && isWrong && (
                        <XCircle size={14} className="text-destructive" />
                      )}
                      {val}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {(qType === "input" || qType === "essay") && (
            <div className="space-y-3">
              {!isSubmitted ? (
                qType === "essay" ? (
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="在此输入答案..."
                    rows={5}
                    className="min-h-[120px] text-xs font-mono resize-none"
                    autoFocus
                  />
                ) : (
                  <Input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="在此输入答案..."
                    className="text-xs font-mono"
                    autoFocus
                  />
                )
              ) : (
                <div className="px-3 py-2.5 text-xs font-mono text-muted-foreground border border-border/40 rounded-lg">
                  你的答案：{selectedAnswer}
                </div>
              )}
            </div>
          )}

          {/* Submit / Next button */}
          <div className="mt-5">
            {!isSubmitted ? (
              <Button
                size="lg"
                onClick={qType === "input" || qType === "essay" ? handleTextSubmit : qType === "multiple" ? handleMultiSubmit : handleSubmit}
                disabled={qType === "input" || qType === "essay" ? !textInput.trim() : qType === "multiple" ? multiSelected.length === 0 : !selectedAnswer}
                className="w-full text-xs font-mono tracking-wider uppercase"
              >
                确认答案
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Explanation */}
                {current.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-accent/30 bg-accent/[0.07] rounded-lg"
                  >
                    <span className="text-xs font-mono text-accent font-bold tracking-wider uppercase block mb-1.5">
                      详细解析
                    </span>
                    <p className="text-sm font-mono text-foreground leading-relaxed">
                      {current.explanation}
                    </p>
                  </motion.div>
                )}

                <Button
                  size="lg"
                  onClick={currentIndex < displayQuestions.length - 1 ? goNext : handleFinish}
                  className="w-full text-xs font-mono tracking-wider uppercase"
                >
                  {currentIndex < displayQuestions.length - 1 ? "下一题" : "查看结果"}
                </Button>
              </div>
            )}
          </div>
          </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between shrink-0 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="text-xs font-mono gap-1"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          上一题
        </Button>

        {wrongIds.length > 0 && mode === "normal" && (
          <Button
            variant="link"
            size="sm"
            onClick={() => switchMode("wrong-book")}
            className="text-xs font-mono gap-1 text-accent"
          >
            <BookX size={14} strokeWidth={1.5} />
            错题本 ({wrongIds.length})
          </Button>
        )}

        {currentIndex === displayQuestions.length - 1 && isSubmitted ? (
          selectedChapters.length > 0 || selectedTypes.length > 0 ? (
            <Button
              size="sm"
              onClick={() => { setSelectedChapters([]); setSelectedTypes([]) }}
              className="text-xs font-mono"
            >
              筛选题已答完，查看全部
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleFinish}
              className="text-xs font-mono"
            >
              完成答题
            </Button>
          )
        ) : currentIndex < displayQuestions.length - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            className="text-xs font-mono gap-1"
          >
            下一题
            <ChevronRight size={14} strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>

      {/* Filter dialog */}
      <Dialog open={showFilter} onOpenChange={(open) => { setShowFilter(open); if (open) savedFilterIndexRef.current = null }}>
        <DialogContent className="glass-dialog max-w-sm max-h-[80vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            筛选设置
          </DialogTitle>

          {/* Type filters */}
          <div className="mt-3">
            <div className="text-xs font-mono text-muted-foreground mb-2">按题型</div>
            <div className="flex gap-2">
              {(["choice", "multiple", "truefalse", "input", "essay"] as const).map((t) => {
                const label = t === "choice" ? "选择题" : t === "multiple" ? "多选题" : t === "truefalse" ? "判断题" : t === "essay" ? "简答题" : "填空题"
                const active = selectedTypes.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => {
                      if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = currentIndex
                      setSelectedTypes((prev) =>
                        active ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }}
                    className={`flex-1 px-2 py-1.5 text-xs font-mono border transition-colors rounded-md ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/30"
                    }`}
                  >
                    {active ? "✓ " : ""}{label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chapter filters */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">按章节</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = currentIndex
                    setSelectedChapters(allChapters)
                  }}
                  className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  全选
                </button>
                <button
                  onClick={() => {
                    if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = currentIndex
                    setSelectedChapters([])
                  }}
                  className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {allChapters.map((ch) => {
                const active = selectedChapters.includes(ch)
                return (
                  <button
                    key={ch}
                    onClick={() => {
                      if (savedFilterIndexRef.current === null) savedFilterIndexRef.current = currentIndex
                      setSelectedChapters((prev) =>
                        active ? prev.filter((x) => x !== ch) : [...prev, ch]
                      )
                    }}
                    className={`w-full text-left px-2 py-1 text-xs font-mono border transition-colors rounded-md ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                    }`}
                  >
                    {active ? "✓ " : "  "}{ch}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info */}
          <div className="mt-3 text-xs font-mono text-muted-foreground">
            {filteredQuestions.length} 题（共 {activeQuestions.length} 题）
          </div>
        </DialogContent>
      </Dialog>

      {/* Outline dialog */}
      <Dialog open={showOutline} onOpenChange={setShowOutline}>
        <DialogContent className="glass-dialog w-[calc(100vw-2rem)] sm:max-w-md max-h-[70vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            答题大纲 — 点击跳转
          </DialogTitle>
          <div className="mt-3 space-y-3">
            {Array.from(chaptersMap.entries()).map(([ch, chQuestions]) => {
              // Group consecutive questions of the same type (follows actual question order)
              const typeGroups: { label: string; key: string; qs: Question[] }[] = []
              for (const q of chQuestions) {
                const t = getQuestionType(q)
                const label = t === "choice" ? "选择题" : t === "multiple" ? "多选题" : t === "truefalse" ? "判断题" : t === "essay" ? "简答题" : "填空题"
                const last = typeGroups[typeGroups.length - 1]
                if (last && last.key === t) {
                  last.qs.push(q)
                } else {
                  typeGroups.push({ label, key: t, qs: [q] })
                }
              }

              return (
                <div key={ch} className="border border-border/40 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-accent/5">
                    <span className="text-xs font-mono text-accent font-bold">{ch}</span>
                    <span className="text-xs font-mono text-muted-foreground">{chQuestions.length} 题</span>
                  </div>
                  {typeGroups.map((g, gi) => (
                    <div key={`${g.key}-${gi}`}>
                      <div className="px-3 py-1 text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                        {g.label}（{g.qs.length}）
                      </div>
                      <div className="divide-y divide-foreground/5">
                        {g.qs.map((q) => {
                          const qIndex = displayQuestions.indexOf(q)
                          const answered = submittedIds.has(q.id)
                          const correct = answered && (getQuestionType(q) === "multiple" ? normalizeMultiLetters(answers[q.id] || '') === normalizeMultiLetters(q.answer || '') : matchAnswer(answers[q.id], q.answer))
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setCurrentIndex(qIndex)
                                setTextInput("")
                                setShowOutline(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors flex items-center gap-2 ${
                                currentIndex === qIndex
                                  ? "bg-accent/10 text-accent"
                                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                              }`}
                            >
                              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                                !answered ? "bg-muted-foreground/30" : correct ? "bg-accent" : "bg-destructive"
                              }`} />
                              <span className="shrink-0 w-5 text-center font-bold">{q.number}</span>
                              <span className="truncate flex-1">{q.question}</span>
                              <span className={`shrink-0 px-1 py-0.5 text-[8px] uppercase tracking-wider border ${
                                !answered
                                  ? "border-muted/30 text-muted-foreground"
                                  : correct
                                  ? "border-accent/40 text-accent"
                                  : "border-destructive/40 text-destructive"
                              }`}>
                                {!answered ? "未答" : correct ? "正确" : "错误"}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            <div className="border border-border/40 p-3 bg-accent/5 rounded-lg">
              <div className="text-xs font-mono font-bold text-foreground">总计</div>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                {displayQuestions.length} 题 | 已答 {submittedIds.size} 题 | 未答 {unanswered} 题
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
