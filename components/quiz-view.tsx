"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, RotateCcw, BookX, CheckCircle2, XCircle, ArrowLeft, ListTree, Filter, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import type { Question } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PieChart as RechartsPieChart, Pie } from "recharts"
import { ACHIEVEMENTS } from "@/lib/achievements"
import { QuizStreak } from "@/components/quiz-streak"
import { QuizEncouragement } from "@/components/quiz-encouragement"
import { QuizSoundToggle } from "@/components/quiz-sound-toggle"
import { QuizParticles } from "@/components/quiz-particles"
import { QuizTimer } from "@/components/quiz-timer"
import { QuizCelebration } from "@/components/quiz-celebration"
import { useStreak } from "@/hooks/use-streak"
import { useSound } from "@/hooks/use-sound"
import { useAchievements } from "@/hooks/use-achievements"

interface QuizViewProps {
  questions: Question[]
  onReset: () => void
  onUpdateWrong: (ids: string[]) => void
  onClearWrong: () => void
  onRemoveWrong?: (id: string) => void
  onUpdateQuestion?: (q: Question) => void
  onAddQuestion?: (q: Question) => void
  onDeleteQuestion?: (id: string) => void
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
  optionShuffled: boolean
  shuffledOptionMap: Record<string, number[]>
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
    r = r.replace(/<!--.*?-->/gs, '')
    r = r.replace(/^[`'""'´ˋ]|[`'""'´ˋ]$/g, '')
    r = r.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    r = r.replace(/[＜]/g, '<').replace(/[＞]/g, '>').replace(/[：]/g, ':').replace(/[；]/g, ';')
    r = r.toLowerCase()
    r = r.replace(/\s+/g, ' ')
    r = r.replace(/[（(].*?[）)]/g, '').trim()
    r = r.replace(/^[a-d][.、．）)\s]\s*/, '')
    if (r === '对' || r === '正确') return 'true'
    if (r === '错' || r === '错误') return 'false'
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
    const alts = inside[1].split(/、|，|\s*或\s*|\s*\/\s*/).map((s) => s.trim()).filter(Boolean)
    if (alts.some((alt) => normalize(userAnswer) === normalize(alt))) return true
  }
  // Check slash-separated alternatives: "多态/Polymorphism" → "多态" or "Polymorphism"
  if (b.includes('/') || b.includes('／')) {
    const slashAlts = b.split(/\s*[/／]\s*/).map((s) => s.trim().replace(/[.。\s]+$/, '')).filter(Boolean)
    if (slashAlts.length > 1 && slashAlts.some((alt) => a === alt)) return true
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

export function QuizView({ questions, onReset, onUpdateWrong, onClearWrong, onRemoveWrong, onUpdateQuestion, onAddQuestion, onDeleteQuestion, wrongIds, initialMode, focusMode, onToggleFocus, filterKey, subjectId }: QuizViewProps) {
  const [mode, setMode] = useState<QuizMode>(initialMode || "normal")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const [isFinished, setIsFinished] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const [showOutline, setShowOutline] = useState(false)
  const [quizMode, setQuizMode] = useState<"sequential" | "shuffled">("sequential")
  const [optionShuffled, setOptionShuffled] = useState(false)
  const [shuffledOptionMap, setShuffledOptionMap] = useState<Record<string, number[]>>({})
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[] | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<("choice" | "truefalse" | "input" | "essay" | "multiple")[]>([])
  const [showFilter, setShowFilter] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [addType, setAddType] = useState<Question["type"]>("essay")
  const [addQuestion, setAddQuestion] = useState("")
  const [addOptions, setAddOptions] = useState<string[]>(["", "", "", ""])
  const [addAnswer, setAddAnswer] = useState("")
  const [addExplanation, setAddExplanation] = useState("")
  const [addChapter, setAddChapter] = useState("")
  const [addNewChapter, setAddNewChapter] = useState(false)
  const savedFilterIndexRef = useRef<number | null>(null)
  const returningFromEmptyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef<string | null>(null)
  const isRestoringRef = useRef(false)

  // Engagement hooks
  const { streak, onAnswer, resetStreak, hasMilestoneTriggered } = useStreak()
  const { playCorrect, playWrong, muted, toggleMute } = useSound()
  const { newUnlocks, checkAchievements, clearNewUnlocks, unlockedDetails } = useAchievements()
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [celebrationKey, setCelebrationKey] = useState(0)
  const [celebrationType, setCelebrationType] = useState<"milestone" | "confetti" | "complete">("milestone")
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [correctGlow, setCorrectGlow] = useState(false)
  const [wrongShake, setWrongShake] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [editForm, setEditForm] = useState({ question: "", options: [""], answer: "", explanation: "", number: 0 })

  // Close edit dialog when switching modes
  useEffect(() => { setEditingQuestion(null) }, [mode])

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
    setOptionShuffled(false)
    setShuffledOptionMap({})
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

  // Milestone tracking
  useEffect(() => {
    if (displayQuestions.length === 0 || isFinished) return
    const pct = Math.round((submittedIds.size / displayQuestions.length) * 100)
    if ([25, 50, 75, 100].includes(pct) && !hasMilestoneTriggered(pct)) {
      setCelebrationKey((k) => k + 1)
      setCelebrationType(pct === 100 ? "confetti" : "milestone")
    }
  }, [submittedIds.size, displayQuestions.length, isFinished])

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
      // Restore option shuffling
      if (typeof saved.optionShuffled === "boolean") setOptionShuffled(saved.optionShuffled)
      if (saved.shuffledOptionMap) setShuffledOptionMap(saved.shuffledOptionMap)
      // Set filters + index + finished last, suppressing the filter-change reset
      returningFromEmptyRef.current = true
      setSelectedChapters(saved.selectedChapters)
      setSelectedTypes(saved.selectedTypes as ("choice" | "truefalse" | "input" | "essay" | "multiple")[])
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
      optionShuffled,
      shuffledOptionMap,
    }
    saveProgress(subjectId, progress)
  }, [subjectId, currentIndex, answers, submittedIds, quizMode, shuffledQuestions, selectedChapters, selectedTypes, isFinished, optionShuffled, shuffledOptionMap])

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

  const shuffleOptionsOnly = () => {
    if (optionShuffled) {
      setOptionShuffled(false)
      setShuffledOptionMap({})
      return
    }
    const map: Record<string, number[]> = {}
    const target = quizMode === "shuffled" && shuffledQuestions ? shuffledQuestions : filteredQuestions
    for (const q of target) {
      const indices = q.options.map((_, i) => i)
      // Only shuffle if more than 2 options (skip true/false)
      if (indices.length > 2) {
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]]
        }
      }
      map[q.id] = indices
    }
    setShuffledOptionMap(map)
    setOptionShuffled(true)
  }

  const getDisplayOptions = (q: Question): { letter: string; origIndex: number; text: string; displayText: string }[] => {
    const stripPrefix = (t: string) => t.replace(/^[A-Da-d][.、）)\s．]\s*/, '')
    if (optionShuffled && shuffledOptionMap[q.id]) {
      return shuffledOptionMap[q.id].map((origIndex, displayPos) => ({
        letter: String.fromCharCode(65 + displayPos),
        origIndex,
        text: q.options[origIndex],
        displayText: stripPrefix(q.options[origIndex]),
      }))
    }
    return q.options.map((text, i) => ({
      letter: String.fromCharCode(65 + i),
      origIndex: i,
      text,
      displayText: stripPrefix(text),
    }))
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
    const isCorrect = sorted === correct
    onAnswer(isCorrect)
    if (isCorrect) { playCorrect(); setCorrectGlow(true); setTimeout(() => setCorrectGlow(false), 600); setCelebrationKey(k => k + 1); setCelebrationType("confetti") }
    else { playWrong(); setWrongShake(true); setTimeout(() => setWrongShake(false), 300) }
    setLastCorrect(isCorrect)
    if (!isCorrect) {
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
    const isCorrect = matchAnswer(textInput.trim(), current.answer)
    onAnswer(isCorrect)
    if (isCorrect) { playCorrect(); setCorrectGlow(true); setTimeout(() => setCorrectGlow(false), 600); setCelebrationKey(k => k + 1); setCelebrationType("confetti") }
    else { playWrong(); setWrongShake(true); setTimeout(() => setWrongShake(false), 300) }
    setLastCorrect(isCorrect)
    if (!isCorrect) {
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

    const isCorrect = matchAnswer(selectedAnswer, current.answer)
    onAnswer(isCorrect)
    if (isCorrect) { playCorrect(); setCorrectGlow(true); setTimeout(() => setCorrectGlow(false), 600); setCelebrationKey(k => k + 1); setCelebrationType("confetti") }
    else { playWrong(); setWrongShake(true); setTimeout(() => setWrongShake(false), 300) }
    setLastCorrect(isCorrect)
    if (!isCorrect) {
      if (!wrongIds.includes(current.id)) {
        onUpdateWrong([...wrongIds, current.id])
      }
    }
  }

  const goNext = () => {
    setLastCorrect(null)
    if (currentIndex < displayQuestions.length - 1) {
      setCurrentIndex((i) => i + 1)
      resetInputs()
    }
  }

  const goPrev = () => {
    setLastCorrect(null)
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      resetInputs()
    }
  }

  const handleFinish = () => {
    setIsFinished(true)
    setCelebrationKey((k) => k + 1)
    setCelebrationType("complete")
    checkAchievements({
      totalCorrect,
      maxStreak: streak.max,
      subjectCompleted: true,
      wrongBookCleared: wrongIds.length === 0,
      fastAnswerCount: 0,
      totalAnswered: submittedIds.size,
    })
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setAnswers({})
    setSubmittedIds(new Set())
    setIsFinished(false)
    resetInputs()
    resetStreak()
    clearNewUnlocks()
    setTimerResetKey((k) => k + 1)
    if (subjectId) clearProgress(subjectId)
  }

  const switchMode = (m: QuizMode) => {
    setMode(m)
    setCurrentIndex(0)
    resetInputs()
    if (m === "wrong-book") {
      setQuizMode("sequential")
      setShuffledQuestions(null)
    }
  }

  const [timerResetKey, setTimerResetKey] = useState(0)
  const handleTimerTimeUp = useCallback(() => {
    if (!current) return
    if (!submittedIds.has(current.id)) {
      if (qType === "input" || qType === "essay") {
        if (textInput.trim()) handleTextSubmit()
      } else if (qType === "multiple") {
        if (multiSelected.length > 0) handleMultiSubmit()
      } else if (selectedAnswer) {
        handleSubmit()
      }
    }
    if (currentIndex < displayQuestions.length - 1) {
      goNext()
    } else {
      handleFinish()
    }
  }, [current, qType, selectedAnswer, textInput, multiSelected, submittedIds, currentIndex, displayQuestions.length])
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
        if (optionShuffled && shuffledOptionMap[current.id]) {
          const origIdx = shuffledOptionMap[current.id][idx]
          if (current.options[origIdx]) {
            e.preventDefault()
            handleSelect(current.options[origIdx])
          }
        } else {
          if (current.options[idx]) {
            e.preventDefault()
            handleSelect(current.options[idx])
          }
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
    const rate = displayQuestions.length > 0
      ? Math.round((totalCorrect / displayQuestions.length) * 100)
      : 0
    const maxStreak = streak.max
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

          {Array.from(chaptersMap.entries()).length > 1 && (
            <div className="mb-6 text-left">
              <div className="text-[10px] font-mono text-muted-foreground mb-2">章节正确率</div>
              {Array.from(chaptersMap.entries()).map(([ch, chQs]) => {
                const chCorrect = chQs.filter((q) => {
                  if (!submittedIds.has(q.id)) return false
                  const t = getQuestionType(q)
                  if (t === "multiple") return normalizeMultiLetters(answers[q.id] || '') === normalizeMultiLetters(q.answer || '')
                  return matchAnswer(answers[q.id], q.answer)
                }).length
                const answered = chQs.filter((q) => submittedIds.has(q.id)).length
                if (answered === 0) return null
                const chRate = Math.round((chCorrect / answered) * 100)
                return (
                  <div key={ch} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono w-16 truncate text-muted-foreground">{ch}</span>
                    <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${chRate}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{chRate}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {newUnlocks.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] font-mono text-accent mb-2">新成就解锁！</div>
              <div className="flex justify-center gap-3 flex-wrap">
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

          {unlockedDetails.length > 0 && (
            <div className="mb-6 text-left">
              <div className="text-[10px] font-mono text-muted-foreground mb-2">已获得成就</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {unlockedDetails.map((a) => (
                  <div key={a.id} className="flex items-center gap-1 px-2 py-0.5 bg-muted/20 rounded-md">
                    <span className="text-xs">{a.icon}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode !== "wrong-book" && wrongIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setIsFinished(false); switchMode("wrong-book") }}
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
              onClick={() => setIsFinished(false)}
              className="gap-2 text-xs font-mono"
            >
              <ListTree size={14} strokeWidth={1.5} />查看答题
            </Button>
            <Button variant="outline" size="sm" onClick={handleRestart} className="gap-2 text-xs font-mono">
              <RotateCcw size={14} strokeWidth={1.5} />重新答题
            </Button>
            <Button onClick={onReset} className="gap-2 text-xs font-mono">返回首页</Button>
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
      <>
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
              onClick={() => setShowAddQuestion(true)}
              className="text-xs font-mono gap-1"
              title="添加题目"
            >
              <Plus size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">添加</span>
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
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm({ question: q.question, options: q.options ? [...q.options] : [], answer: q.answer || "", explanation: q.explanation || "", number: q.number })
                        setEditingQuestion(q)
                      }}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors"
                      title="编辑题目"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteQuestion?.(q.id)}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors"
                      title="删除题目"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Question text */}
                  <h3 className="text-sm font-mono text-foreground leading-relaxed mb-4 whitespace-pre-wrap">
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
                      <div className="text-foreground whitespace-pre-wrap mt-1">{qt === "multiple" ? normalizeMultiLetters(q.answer) : q.answer}</div>
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

      <Dialog open={editingQuestion !== null} onOpenChange={(open) => { if (!open) setEditingQuestion(null) }}>
        <DialogContent className="glass-dialog max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            编辑题目
          </DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">题号</label>
              <Input
                type="number"
                value={editForm.number}
                onChange={(e) => setEditForm((f) => ({ ...f, number: Number(e.target.value) }))}
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">题目</label>
              <Textarea
                value={editForm.question}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">选项（每行一个）</label>
              <Textarea
                value={editForm.options.join("\n")}
                onChange={(e) => setEditForm((f) => ({ ...f, options: e.target.value.split("\n") }))}
                rows={4}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">答案</label>
              <Textarea
                value={editForm.answer}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                rows={5}
                className="text-xs font-mono resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">解析</label>
              <Textarea
                value={editForm.explanation}
                onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                rows={4}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingQuestion(null)}
                className="text-xs font-mono"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!onUpdateQuestion || !editingQuestion) return
                  onUpdateQuestion({
                    ...editingQuestion,
                    question: editForm.question,
                    options: editForm.options,
                    answer: editForm.answer,
                    explanation: editForm.explanation,
                    number: editForm.number,
                  })
                  setEditingQuestion(null)
                }}
                className="text-xs font-mono"
              >
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog open={showAddQuestion} onOpenChange={(open) => {
        setShowAddQuestion(open)
        if (!open) {
          setAddQuestion("")
          setAddOptions(["", "", "", ""])
          setAddAnswer("")
          setAddExplanation("")
          setAddChapter("")
          setAddType("essay")
        }
      }}>
        <DialogContent className="glass-dialog max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground text-center">
            添加题目
          </DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">题型</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {([["choice", "选择题"], ["multiple", "多选题"], ["truefalse", "判断题"], ["input", "填空题"], ["essay", "简答题"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => {
                      setAddType(val)
                      setAddAnswer("")
                      if (val === "truefalse") setAddOptions(["对", "错"])
                      else if (val === "choice" && addOptions.filter(Boolean).length < 2) setAddOptions(["", "", "", ""])
                      else if (val === "multiple" && addOptions.filter(Boolean).length < 2) setAddOptions(["", "", "", ""])
                      else if (val !== "choice" && val !== "multiple") setAddOptions([])
                    }}
                    className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                      addType === val
                        ? "bg-accent text-accent-foreground border-accent"
                        : "border-border/40 text-muted-foreground hover:border-accent/30 hover:text-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">题目</Label>
              <textarea
                value={addQuestion}
                onChange={(e) => setAddQuestion(e.target.value)}
                placeholder="输入题目内容..."
                className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50 min-h-[60px]"
              />
            </div>

            {(addType === "choice" || addType === "multiple") && (
              <div>
                <Label className="text-[10px] font-mono text-muted-foreground">选项</Label>
                <div className="space-y-1.5 mt-1.5">
                  {addOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...addOptions]
                          next[i] = e.target.value
                          setAddOptions(next)
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                        className="flex-1 px-2 py-1.5 text-[11px] font-mono bg-transparent border border-border/40 rounded-md focus:outline-none focus:border-accent/50"
                      />
                      {addOptions.length > 2 && (
                        <button
                          onClick={() => setAddOptions(addOptions.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive text-[10px]"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setAddOptions([...addOptions, ""])}
                    className="text-[10px] font-mono text-accent hover:text-accent/80 mt-1"
                  >
                    + 添加选项
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">答案</Label>
              {addType === "truefalse" ? (
                <div className="flex gap-2 mt-1.5">
                  {["对", "错"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAddAnswer(v)}
                      className={`px-4 py-2 text-[11px] font-mono rounded-lg border transition-colors ${
                        addAnswer === v
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border/40 text-muted-foreground hover:border-accent/30"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : addType === "choice" ? (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {addOptions.filter(Boolean).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setAddAnswer(String.fromCharCode(65 + i))}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                        addAnswer === String.fromCharCode(65 + i)
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border/40 text-muted-foreground hover:border-accent/30"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
              ) : addType === "multiple" ? (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {addOptions.filter(Boolean).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const letter = String.fromCharCode(65 + i)
                        const current = addAnswer.split("")
                        const next = current.includes(letter)
                          ? current.filter(c => c !== letter).join("")
                          : [...current, letter].sort().join("")
                        setAddAnswer(next)
                      }}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                        addAnswer.includes(String.fromCharCode(65 + i))
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border/40 text-muted-foreground hover:border-accent/30"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={addAnswer}
                  onChange={(e) => setAddAnswer(e.target.value)}
                  placeholder="输入答案..."
                  rows={5}
                  className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50"
                />
              )}
            </div>

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">解析（可选）</Label>
              <textarea
                value={addExplanation}
                onChange={(e) => setAddExplanation(e.target.value)}
                placeholder="输入解析..."
                className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50 min-h-[40px]"
              />
            </div>

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">章节（可选）</Label>
              {!addNewChapter ? (
                <div className="flex gap-2">
                  <select
                    value={addChapter}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setAddNewChapter(true)
                        setAddChapter("")
                      } else {
                        setAddChapter(e.target.value)
                      }
                    }}
                    className="flex-1 mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg focus:outline-none focus:border-accent/50 [&>option]:bg-background"
                  >
                    <option value="">不选择</option>
                    {Array.from(new Set(questions.map((q) => q.chapter).filter(Boolean))).map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                    <option value="__new__">新建章节...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2 items-center mt-1.5">
                  <input
                    value={addChapter}
                    onChange={(e) => setAddChapter(e.target.value)}
                    placeholder="输入新章节名称"
                    autoFocus
                    className="flex-1 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg focus:outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={() => { setAddNewChapter(false); setAddChapter("") }}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground shrink-0"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={() => {
                if (!addQuestion.trim() || !addAnswer.trim()) return
                if ((addType === "choice" || addType === "multiple") && addOptions.filter(Boolean).length < 2) return
                const ch = addChapter.trim() || "未分类"
                const chapterQ = questions.filter((q) => (q.chapter || "未分类") === ch)
                const maxNum = chapterQ.length > 0 ? Math.max(...chapterQ.map((q) => q.number)) : 0
                const newQ: Question = {
                  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  number: maxNum + 1,
                  question: addQuestion.trim(),
                  options: (addType === "choice" || addType === "multiple") ? addOptions.filter(Boolean) : [],
                  answer: addAnswer.trim(),
                  explanation: addExplanation.trim(),
                  chapter: addChapter.trim() || undefined,
                  type: addType,
                }
                onAddQuestion?.(newQ)
                setShowAddQuestion(false)
                setAddQuestion("")
                setAddOptions(["", "", "", ""])
                setAddAnswer("")
                setAddExplanation("")
                setAddChapter("")
                setAddType("essay")
              }}
              disabled={!addQuestion.trim() || !addAnswer.trim() || ((addType === "choice" || addType === "multiple") && addOptions.filter(Boolean).length < 2)}
              className="w-full gap-2 text-xs font-mono tracking-wider uppercase h-auto py-4"
            >
              <Plus size={14} strokeWidth={1.5} />
              添加题目
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>)
  }

  return (
    <div ref={containerRef} className={`w-full max-w-4xl mx-auto px-4 h-full flex flex-col min-h-0 overscroll-x-none touch-pan-y ${focusMode ? "pt-[env(safe-area-inset-top)]" : ""}`}>
      {focusMode && <QuizParticles />}
      <QuizCelebration key={celebrationKey} triggered={celebrationKey > 0} type={celebrationType} />
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

          {/* Unified toolbar */}
          <div className="flex items-center gap-1">
            <QuizSoundToggle muted={muted} onToggle={toggleMute} />
            <QuizTimer
              enabled={timerEnabled}
              onToggle={() => setTimerEnabled(!timerEnabled)}
              onTimeUp={handleTimerTimeUp}
              isSubmitted={isSubmitted}
              key_={currentIndex + timerResetKey * 10000}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              className="text-xs font-mono gap-1 text-muted-foreground hover:text-foreground"
              title="重新开始"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">重新开始</span>
            </Button>
            {!isFinished && submittedIds.size === displayQuestions.length && displayQuestions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFinish}
                className="text-xs font-mono gap-1 text-accent hover:text-accent"
                title="查看结果"
              >
                <span>查看结果</span>
              </Button>
            )}
            <button
              onClick={onReset}
              className="text-xs font-mono text-muted-foreground hover:text-destructive transition-colors"
            >
              退出
            </button>
            <div className="ml-auto">
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-mono">
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-dialog min-w-[160px] rounded-xl border-border/40">
                {mode !== "wrong-book" && mode !== "review" && (
                  <DropdownMenuItem onClick={() => setShowFilter(true)} className="text-xs font-mono gap-2 cursor-pointer">
                    <Filter size={12} strokeWidth={1.5} />
                    筛选
                    {(selectedChapters.length > 0 || selectedTypes.length > 0) && (
                      <span className="text-accent font-bold ml-auto">
                        ({selectedChapters.length || "全"}/{selectedTypes.length || "全"})
                      </span>
                    )}
                  </DropdownMenuItem>
                )}
                {mode !== "wrong-book" && mode !== "review" && (
                  <DropdownMenuItem onClick={quizMode === "shuffled" ? setSequential : shuffleQuestions} className="text-xs font-mono gap-2 cursor-pointer">
                    {quizMode === "shuffled" ? "顺序答题" : "打乱顺序"}
                  </DropdownMenuItem>
                )}
                {mode !== "wrong-book" && mode !== "review" && (
                  <DropdownMenuItem onClick={shuffleOptionsOnly} className="text-xs font-mono gap-2 cursor-pointer">
                    {optionShuffled ? "恢复选项顺序" : "打乱选项"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowOutline(true)} className="text-xs font-mono gap-2 cursor-pointer">
                  <ListTree size={12} strokeWidth={1.5} />
                  大纲
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 shrink-0">
        <Progress value={((currentIndex + 1) / displayQuestions.length) * 100} className="h-1.5 bg-muted/50" />
      </div>

      {/* Question counter & type badge */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-muted-foreground">
            {currentIndex + 1} / {displayQuestions.length}
            <span className="ml-2">| 未答 {unanswered} 题</span>
          </div>
          <QuizStreak streak={streak.current} maxStreak={streak.max} focusMode={focusMode} />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono tracking-wider border-accent/30 bg-accent/5 text-accent hover:bg-accent/10">
            {qType === "choice" ? "选择题" : qType === "multiple" ? "多选题" : qType === "truefalse" ? "判断题" : qType === "essay" ? "简答题" : "填空题"}
          </Badge>
        </div>
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
          <Card className={`mb-4 border-border/40 shadow-sm bg-card/80 backdrop-blur-xl ${correctGlow ? "animate-correct-glow" : ""} ${wrongShake ? "animate-wrong-shake" : ""}`}>
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
              {(qType === "truefalse" ? !matchAnswer(selectedAnswer, current.answer) : selectedAnswer !== current.answer) && (qType !== "multiple" ? true : normalizeMultiLetters(selectedAnswer) !== normalizeMultiLetters(current.answer)) && (
                <div className="px-4 py-3 space-y-1.5 bg-background/50">
                  <div className="text-xs font-mono">
                    <span className="text-muted-foreground">你的答案：</span>
                    <div className="text-destructive font-bold whitespace-pre-wrap">{qType === "multiple" ? selectedAnswer : selectedAnswer}</div>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="text-muted-foreground">正确答案：</span>
                    <div className="text-accent font-bold whitespace-pre-wrap">{qType === "multiple" ? normalizeMultiLetters(current.answer) : current.answer}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Encouragement */}
          <div className="mb-3">
            <QuizEncouragement streak={streak.current} lastCorrect={lastCorrect} />
          </div>

          {/* Answer input area */}
          {isSubmitted && lastCorrect !== null && (
            <div className={`mb-4 px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 ${
              lastCorrect
                ? "bg-accent/25 text-accent border border-accent/30"
                : "bg-destructive/20 text-destructive border border-destructive/30"
            }`}>
              <span className="text-lg">{lastCorrect ? "✓" : "✗"}</span>
              <span>{lastCorrect ? "回答正确！" : "回答错误"}</span>
            </div>
          )}
          {optionShuffled && (qType === "choice" || qType === "multiple") && (
            <div className="mb-3 px-3 py-2 border border-accent/20 bg-accent/5 rounded-lg">
              <span className="text-[9px] font-mono text-accent">选项已打乱，解析仍引用原始 A/B/C/D</span>
            </div>
          )}
          {qType === "choice" && (
            <div className="space-y-2">
              {(() => {
                const displayOpts = getDisplayOptions(current)
                return displayOpts.map(({ letter, origIndex, text, displayText }) => {
                  const isSelected = selectedAnswer === text
                  const isAnswer = isSubmitted && text === current.answer
                  const isWrong = isSubmitted && isSelected && text !== current.answer
                  return (
                    <button
                      key={origIndex}
                      onClick={() => handleSelect(text)}
                      disabled={isSubmitted}
                      className={`w-full text-left px-4 py-3 text-xs font-mono leading-relaxed transition-all rounded-xl border-l-4 ${
                        isSubmitted
                          ? isAnswer
                            ? "border-l-accent border border-accent/40 bg-accent/20 text-foreground font-bold"
                            : isWrong
                            ? "border-l-destructive border border-destructive/40 bg-destructive/20 text-foreground font-bold"
                            : "border-l-transparent border border-transparent text-muted-foreground"
                          : isSelected
                          ? "border-l-accent/60 border border-accent/30 bg-accent/10 text-foreground"
                          : "border-l-transparent border border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isSubmitted && isAnswer && (
                          <CheckCircle2 size={16} className="shrink-0 text-accent" />
                        )}
                        {isSubmitted && isWrong && (
                          <XCircle size={16} className="shrink-0 text-destructive" />
                        )}
                        <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{letter}.</span>
                        {displayText}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
          )}

          {qType === "multiple" && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                {multiSelected.length} 个已选（可多选）
              </div>
              {(() => {
                const displayOpts = getDisplayOptions(current)
                return displayOpts.map(({ letter: _dispLetter, origIndex, text }) => {
                  const origLetter = String.fromCharCode(65 + origIndex)
                  const isSelected = multiSelected.includes(origLetter)
                  const isCorrect = isSubmitted && normalizeMultiLetters(current.answer).includes(origLetter)
                  const isWrong = isSubmitted && isSelected && !normalizeMultiLetters(current.answer).includes(origLetter)
                  return (
                    <button
                      key={origIndex}
                      onClick={() => handleMultiToggle(origLetter)}
                      disabled={isSubmitted}
                      className={`w-full text-left px-4 py-3 text-xs font-mono leading-relaxed transition-all rounded-xl border-l-4 ${
                        isSubmitted
                          ? isCorrect
                            ? "border-l-accent border border-accent/40 bg-accent/20 text-foreground font-bold"
                            : isWrong
                            ? "border-l-destructive border border-destructive/40 bg-destructive/20 text-foreground font-bold"
                            : "border-l-transparent border border-transparent text-muted-foreground"
                          : isSelected
                          ? "border-l-accent/60 border border-accent/30 bg-accent/10 text-foreground"
                          : "border-l-transparent border border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
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
                        {text}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
          )}

          {qType === "truefalse" && (
            <div className="flex gap-3">
              {["对", "错"].map((val) => {
                const isSelected = selectedAnswer === val
                const isAnswer = isSubmitted && matchAnswer(val, current.answer)
                const isWrong = isSubmitted && isSelected && !matchAnswer(val, current.answer)

                return (
                  <button
                    key={val}
                    onClick={() => handleSelect(val)}
                    disabled={isSubmitted}
                    className={`flex-1 px-4 py-4 text-sm font-mono font-bold transition-all rounded-xl border-2 ${
                      isSubmitted
                        ? isAnswer
                          ? "border-accent bg-accent/20 text-accent"
                          : isWrong
                          ? "border-destructive bg-destructive/20 text-destructive"
                          : "border-transparent text-muted-foreground bg-foreground/5"
                        : isSelected
                        ? "border-accent/40 bg-accent/8 text-accent"
                        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/5 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSubmitted && isAnswer && (
                        <CheckCircle2 size={16} className="text-accent" />
                      )}
                      {isSubmitted && isWrong && (
                        <XCircle size={16} className="text-destructive" />
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
                <div className="px-3 py-2.5 text-xs font-mono text-muted-foreground border border-border/40 rounded-lg whitespace-pre-wrap">
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
                    <p className="text-sm font-mono text-foreground leading-relaxed whitespace-pre-wrap">
                      {current.explanation}
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setEditForm({ question: current.question, options: current.options ? [...current.options] : [], answer: current.answer || "", explanation: current.explanation || "", number: current.number })
                      setEditingQuestion(current)
                    }}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={12} className="mr-1" /> 编辑
                  </Button>
                </div>

                <Button
                  size="lg"
                  onClick={currentIndex < displayQuestions.length - 1 ? goNext : (selectedChapters.length > 0 || selectedTypes.length > 0 ? () => { setSelectedChapters([]); setSelectedTypes([]) } : handleFinish)}
                  className="w-full text-xs font-mono tracking-wider uppercase"
                >
                  {currentIndex < displayQuestions.length - 1 ? "下一题" : (selectedChapters.length > 0 || selectedTypes.length > 0 ? "筛选题已答完，查看全部" : "查看结果")}
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
                                  ? "bg-accent/15 text-accent"
                                  : !answered
                                  ? "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                  : correct
                                  ? "bg-accent/8 text-accent hover:bg-accent/12"
                                  : "bg-destructive/8 text-destructive hover:bg-destructive/12"
                              }`}
                            >
                              <span className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                !answered
                                  ? "bg-muted-foreground/15 text-muted-foreground"
                                  : correct
                                  ? "bg-accent/20 text-accent"
                                  : "bg-destructive/20 text-destructive"
                              }`}>
                                {!answered ? q.number : correct ? "✓" : "✗"}
                              </span>
                              <span className="truncate flex-1">{q.question}</span>
                              <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded ${
                                !answered
                                  ? "bg-muted-foreground/10 text-muted-foreground"
                                  : correct
                                  ? "bg-accent/20 text-accent"
                                  : "bg-destructive/20 text-destructive"
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

      {/* Question edit dialog */}
      <Dialog open={editingQuestion !== null} onOpenChange={(open) => { if (!open) setEditingQuestion(null) }}>
        <DialogContent className="glass-dialog max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            编辑题目
          </DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">题号</label>
              <Input
                type="number"
                value={editForm.number}
                onChange={(e) => setEditForm((f) => ({ ...f, number: Number(e.target.value) }))}
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">题目</label>
              <Textarea
                value={editForm.question}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">选项（每行一个）</label>
              <Textarea
                value={editForm.options.join("\n")}
                onChange={(e) => setEditForm((f) => ({ ...f, options: e.target.value.split("\n") }))}
                rows={4}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">答案</label>
              <Textarea
                value={editForm.answer}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                rows={5}
                className="text-xs font-mono resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">解析</label>
              <Textarea
                value={editForm.explanation}
                onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                rows={4}
                className="text-xs font-mono resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingQuestion(null)}
                className="text-xs font-mono"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!onUpdateQuestion || !editingQuestion) return
                  onUpdateQuestion({
                    ...editingQuestion,
                    question: editForm.question,
                    options: editForm.options,
                    answer: editForm.answer,
                    explanation: editForm.explanation,
                    number: editForm.number,
                  })
                  setEditingQuestion(null)
                }}
                className="text-xs font-mono"
              >
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
