"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, RotateCcw, BookX, CheckCircle2, XCircle, ArrowLeft, ListTree, Filter } from "lucide-react"
import type { Question } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

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
}

type QuizMode = "normal" | "wrong-book"

function isTrueFalse(q: Question) {
  const ans = q.answer.replace(/[.。\s]/g, "")
  return ans === "对" || ans === "错"
}

function getQuestionType(q: Question): "choice" | "truefalse" | "input" {
  if (q.options.length > 0) return "choice"
  if (isTrueFalse(q)) return "truefalse"
  return "input"
}

export function QuizView({ questions, onReset, onUpdateWrong, onClearWrong, onRemoveWrong, wrongIds, initialMode, focusMode, onToggleFocus }: QuizViewProps) {
  const [mode, setMode] = useState<QuizMode>(initialMode || "normal")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const [isFinished, setIsFinished] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [showOutline, setShowOutline] = useState(false)
  const [quizMode, setQuizMode] = useState<"sequential" | "shuffled">("sequential")
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[] | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<("choice" | "truefalse" | "input")[]>([])
  const [showFilter, setShowFilter] = useState(false)

  // Reset shuffle when questions change
  useEffect(() => {
    setShuffledQuestions(null)
    setQuizMode("sequential")
    setSelectedChapters([])
    setSelectedTypes([])
  }, [questions])

  // Reset shuffle when filters change (recompute from filtered set)
  useEffect(() => {
    setShuffledQuestions(null)
    setQuizMode("sequential")
  }, [selectedChapters, selectedTypes])

  // Reset state when questions change (e.g. subject switch)
  useEffect(() => {
    setCurrentIndex(0)
    setAnswers({})
    setSubmittedIds(new Set())
    setIsFinished(false)
    setTextInput("")
  }, [questions])

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

  const shuffleQuestions = () => {
    const arr = [...filteredQuestions]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffledQuestions(arr)
    setQuizMode("shuffled")
    setCurrentIndex(0)
    setTextInput("")
  }

  const setSequential = () => {
    setQuizMode("sequential")
    setCurrentIndex(0)
    setTextInput("")
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

  const handleTextSubmit = () => {
    if (!textInput.trim() || !current) return
    setAnswers((prev) => ({ ...prev, [current.id]: textInput.trim() }))
    const newSubmitted = new Set(submittedIds)
    newSubmitted.add(current.id)
    setSubmittedIds(newSubmitted)
    if (textInput.trim() !== current.answer) {
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

    if (selectedAnswer !== current.answer) {
      if (!wrongIds.includes(current.id)) {
        onUpdateWrong([...wrongIds, current.id])
      }
    }
  }

  const goNext = () => {
    if (currentIndex < displayQuestions.length - 1) {
      setCurrentIndex((i) => i + 1)
      setTextInput("")
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setTextInput("")
    }
  }

  const handleFinish = () => {
    const correct = displayQuestions.filter(
      (q) => answers[q.id] === q.answer
    ).length
    setIsFinished(true)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setAnswers({})
    setSubmittedIds(new Set())
    setIsFinished(false)
    setTextInput("")
  }

  const switchMode = (m: QuizMode) => {
    setMode(m)
    setCurrentIndex(0)
    setTextInput("")
  }

  const unanswered = displayQuestions.filter((q) => !submittedIds.has(q.id)).length
  const totalCorrect = displayQuestions.filter(
    (q) => submittedIds.has(q.id) && answers[q.id] === q.answer
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
        if (qType === "input" && !isSubmitted && textInput.trim()) {
          e.preventDefault()
          handleTextSubmit()
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
        <div className="border-2 border-foreground/20 p-8 lg:p-12">
          <h2 className="font-pixel text-2xl sm:text-3xl text-foreground mb-6">
            答题完成
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

          {wrongIds.length > 0 && (
            <button
              onClick={() => {
                setIsFinished(false)
                switchMode("wrong-book")
              }}
              className="inline-flex items-center gap-2 border border-foreground/20 px-4 py-2 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors mb-4"
            >
              <BookX size={14} strokeWidth={1.5} />
              查看错题本 ({wrongIds.length})
            </button>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 border border-foreground/20 px-4 py-2 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              重新答题
            </button>
            <button
              onClick={onReset}
              className="bg-foreground text-background px-4 py-2 text-xs font-mono hover:opacity-90 transition-opacity"
            >
              返回首页
            </button>
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
        <button
          onClick={onReset}
          className="mt-4 bg-foreground text-background px-4 py-2 text-xs font-mono"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          {mode === "wrong-book" ? (
            <button onClick={() => switchMode("normal")} className="flex items-center gap-1 text-xs font-mono text-accent hover:underline">
              <ArrowLeft size={14} strokeWidth={1.5} />
              返回答题
            </button>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">答题</span>
          )}
          {mode === "wrong-book" && (
            <span className="text-xs font-mono text-muted-foreground">错题本</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {mode === "wrong-book" && (
            <button
              onClick={() => {
                if (confirm("清空错题本？")) {
                  onClearWrong()
                }
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors"
            >
              清空错题本
            </button>
          )}
          {mode !== "wrong-book" && (
            <button
              onClick={() => setShowFilter(true)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="筛选章节和题型"
            >
              <Filter size={10} strokeWidth={1.5} />
              筛选
              {(selectedChapters.length > 0 || selectedTypes.length > 0) && (
                <span className="text-accent font-bold">
                  ({selectedChapters.length || "全"}/{selectedTypes.length || "全"})
                </span>
              )}
            </button>
          )}
          {mode !== "wrong-book" && (
            <button
              onClick={quizMode === "shuffled" ? setSequential : shuffleQuestions}
              className="text-[10px] font-mono transition-colors flex items-center gap-1"
              title={quizMode === "shuffled" ? "顺序答题" : "打乱顺序"}
            >
              <span className={quizMode === "shuffled" ? "text-accent" : "text-muted-foreground hover:text-foreground"}>
                {quizMode === "shuffled" ? "打乱中" : "打乱顺序"}
              </span>
            </button>
          )}
          {onToggleFocus && (
            <button
              onClick={onToggleFocus}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              title={focusMode ? "退出专注模式" : "专注答题模式"}
            >
              {focusMode ? "退出专注" : "专注答题"}
            </button>
          )}
          <button
            onClick={() => setShowOutline(true)}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ListTree size={14} strokeWidth={1.5} />
            大纲
          </button>
          <button
            onClick={handleRestart}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            重新开始
          </button>
          <button
            onClick={onReset}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            退出
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-foreground/10 mb-6 shrink-0">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: 0 }}
          animate={{
            width: `${((currentIndex + 1) / displayQuestions.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question counter & type badge */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="text-xs font-mono text-muted-foreground">
          {currentIndex + 1} / {displayQuestions.length}
          <span className="ml-2">| 未答 {unanswered} 题</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider border border-foreground/20 px-2 py-0.5 text-muted-foreground">
          {qType === "choice" ? "选择题" : qType === "truefalse" ? "判断题" : "填空题"}
        </span>
      </div>

      {/* Question card */}
      <div className="flex-1 overflow-y-auto min-h-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="border border-foreground/20 p-5 lg:p-6 mb-4"
        >
          {/* Chapter badge row */}
          <div className="flex items-center justify-between mb-2">
            {current.chapter ? (
              <div className="text-[10px] font-mono text-accent tracking-wider uppercase">
                {current.chapter}
              </div>
            ) : (
              <div />
            )}
            {mode === "wrong-book" && onRemoveWrong && (
              <button
                onClick={() => onRemoveWrong(current.id)}
                className="text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors"
              >
                ✕ 移出错题本
              </button>
            )}
          </div>

          {/* Question text */}
          <h3 className="text-sm font-mono text-foreground leading-relaxed mb-5">
            <span className="text-accent font-bold mr-2">{current.number}.</span>
            {current.question}
          </h3>

          {/* Result badge */}
          {isSubmitted && (
            <div className={`mb-4 px-3 py-2 text-xs font-mono font-bold tracking-wider uppercase ${
              selectedAnswer === current.answer
                ? "border border-accent/60 bg-accent/10 text-accent"
                : "border border-destructive/60 bg-destructive/10 text-destructive"
            }`}>
              {selectedAnswer === current.answer ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  正确
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle size={14} className="shrink-0" />
                  错误 — 正确答案：{current.answer}
                </span>
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
                    className={`w-full text-left px-3 py-2.5 text-xs font-mono leading-relaxed transition-all border ${
                      isSubmitted
                        ? isAnswer
                          ? "border-accent/60 bg-accent/10 text-foreground"
                          : isWrong
                          ? "border-destructive/60 bg-destructive/10 text-foreground"
                          : "border-transparent text-muted-foreground"
                        : isSelected
                        ? "border-foreground/40 bg-foreground/5 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-foreground/20 hover:bg-foreground/5 hover:text-foreground"
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
                    className={`flex-1 px-4 py-3 text-sm font-mono font-bold transition-all border ${
                      isSubmitted
                        ? isAnswer
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : isWrong
                          ? "border-destructive/60 bg-destructive/10 text-destructive"
                          : "border-transparent text-muted-foreground"
                        : isSelected
                        ? "border-foreground/40 bg-foreground/5 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-foreground/20 hover:bg-foreground/5 hover:text-foreground"
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

          {qType === "input" && (
            <div className="space-y-3">
              {!isSubmitted ? (
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="在此输入答案..."
                  className="w-full border border-foreground/20 bg-transparent px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/40 transition-colors"
                  autoFocus
                />
              ) : (
                <div className={`px-3 py-2.5 text-xs font-mono border ${
                  selectedAnswer === current.answer
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-destructive/60 bg-destructive/10 text-destructive"
                }`}>
                  <span className="flex items-center gap-2">
                    {selectedAnswer === current.answer ? (
                      <CheckCircle2 size={12} className="shrink-0" />
                    ) : (
                      <XCircle size={12} className="shrink-0" />
                    )}
                    你的答案：{selectedAnswer}
                    {selectedAnswer !== current.answer && (
                      <> | 正确答案：{current.answer}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit / Next button */}
          <div className="mt-5">
            {!isSubmitted ? (
              <button
                onClick={qType === "input" ? handleTextSubmit : handleSubmit}
                disabled={qType === "input" ? !textInput.trim() : !selectedAnswer}
                className="w-full bg-foreground text-background py-2.5 text-xs font-mono tracking-wider uppercase hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                确认答案
              </button>
            ) : (
              <div className="space-y-3">
                {/* Explanation */}
                {current.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 border border-foreground/10 bg-foreground/5"
                  >
                    <span className="text-[10px] font-mono text-accent tracking-wider uppercase block mb-1">
                      解析
                    </span>
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                      {current.explanation}
                    </p>
                  </motion.div>
                )}

                <button
                  onClick={goNext}
                  className="w-full bg-foreground text-background py-2.5 text-xs font-mono tracking-wider uppercase hover:opacity-90 transition-opacity"
                >
                  {currentIndex < displayQuestions.length - 1 ? "下一题" : "查看结果"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          上一题
        </button>

        {wrongIds.length > 0 && mode === "normal" && (
          <button
            onClick={() => switchMode("wrong-book")}
            className="flex items-center gap-1 text-xs font-mono text-accent hover:underline"
          >
            <BookX size={14} strokeWidth={1.5} />
            错题本 ({wrongIds.length})
          </button>
        )}

        {currentIndex === displayQuestions.length - 1 && isSubmitted ? (
          <button
            onClick={handleFinish}
            className="bg-foreground text-background px-3 py-1.5 text-xs font-mono hover:opacity-90 transition-opacity"
          >
            完成答题
          </button>
        ) : currentIndex < displayQuestions.length - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            下一题
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      {/* Filter dialog */}
      <Dialog open={showFilter} onOpenChange={setShowFilter}>
        <DialogContent className="border border-foreground/20 bg-background dot-grid-bg max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            筛选设置
          </DialogTitle>

          {/* Type filters */}
          <div className="mt-3">
            <div className="text-[10px] font-mono text-muted-foreground mb-2">按题型</div>
            <div className="flex gap-2">
              {(["choice", "truefalse", "input"] as const).map((t) => {
                const label = t === "choice" ? "选择题" : t === "truefalse" ? "判断题" : "填空题"
                const active = selectedTypes.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() =>
                      setSelectedTypes((prev) =>
                        active ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                    className={`flex-1 px-2 py-1.5 text-[10px] font-mono border transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-foreground/20 text-muted-foreground hover:text-foreground"
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
              <span className="text-[10px] font-mono text-muted-foreground">按章节</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedChapters(allChapters)}
                  className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  全选
                </button>
                <button
                  onClick={() => setSelectedChapters([])}
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
                    onClick={() =>
                      setSelectedChapters((prev) =>
                        active ? prev.filter((x) => x !== ch) : [...prev, ch]
                      )
                    }
                    className={`w-full text-left px-2 py-1 text-[10px] font-mono border transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {active ? "✓ " : "  "}{ch}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info */}
          <div className="mt-3 text-[10px] font-mono text-muted-foreground">
            {filteredQuestions.length} 题（共 {activeQuestions.length} 题）
          </div>
        </DialogContent>
      </Dialog>

      {/* Outline dialog */}
      <Dialog open={showOutline} onOpenChange={setShowOutline}>
        <DialogContent className="border border-foreground/20 bg-background dot-grid-bg max-w-md max-h-[70vh] overflow-y-auto">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground">
            答题大纲 — 点击跳转
          </DialogTitle>
          <div className="mt-3 space-y-3">
            {Array.from(chaptersMap.entries()).map(([ch, chQuestions]) => {
              // Group consecutive questions of the same type (follows actual question order)
              const typeGroups: { label: string; key: string; qs: Question[] }[] = []
              for (const q of chQuestions) {
                const t = getQuestionType(q)
                const label = t === "choice" ? "选择题" : t === "truefalse" ? "判断题" : "填空题"
                const last = typeGroups[typeGroups.length - 1]
                if (last && last.key === t) {
                  last.qs.push(q)
                } else {
                  typeGroups.push({ label, key: t, qs: [q] })
                }
              }

              return (
                <div key={ch} className="border border-foreground/10">
                  <div className="flex items-center justify-between px-3 py-2 bg-foreground/5">
                    <span className="text-xs font-mono text-accent font-bold">{ch}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{chQuestions.length} 题</span>
                  </div>
                  {typeGroups.map((g, gi) => (
                    <div key={`${g.key}-${gi}`}>
                      <div className="px-3 py-1 text-[8px] font-mono uppercase tracking-wider text-muted-foreground bg-foreground/[0.02]">
                        {g.label}（{g.qs.length}）
                      </div>
                      <div className="divide-y divide-foreground/5">
                        {g.qs.map((q) => {
                          const qIndex = displayQuestions.indexOf(q)
                          const answered = submittedIds.has(q.id)
                          const correct = answers[q.id] === q.answer
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setCurrentIndex(qIndex)
                                setTextInput("")
                                setShowOutline(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-[10px] font-mono transition-colors flex items-center gap-2 ${
                                currentIndex === qIndex
                                  ? "bg-accent/10 text-accent"
                                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                              }`}
                            >
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
            <div className="border border-foreground/10 p-3 bg-foreground/5">
              <div className="text-xs font-mono font-bold text-foreground">总计</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {displayQuestions.length} 题 | 已答 {submittedIds.size} 题 | 未答 {unanswered} 题
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
