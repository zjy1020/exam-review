"use client"

import { useState, useEffect, useCallback } from "react"
import { ImportPanel } from "@/components/import-panel"
import { QuizView } from "@/components/quiz-view"
import { Sidebar } from "@/components/sidebar"
import { CoverPage } from "@/components/cover-page"
import { ThemeToggle } from "@/components/theme-toggle"
import { Menu } from "lucide-react"
import {
  loadSubjects,
  saveSubjects,
  loadActiveSubject,
  saveActiveSubject,
  loadSubjectData,
  saveSubjectData,
  deleteSubject,
  renameSubject,
} from "@/lib/storage"
import type { Question, Subject } from "@/lib/types"

type View = "import" | "quiz" | "wrong-book"

let idCounter = 0
function genId() {
  return `subj-${Date.now()}-${++idCounter}`
}

export default function Page() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [view, setView] = useState<View>("import")
  const [coverDismissed, setCoverDismissed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [importCount, setImportCount] = useState(0)
  const [hasEnteredQuiz, setHasEnteredQuiz] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [filterKey, setFilterKey] = useState(0)

  // Reset quiz-entered flag on re-import
  useEffect(() => {
    setHasEnteredQuiz(false)
  }, [importCount])

  // Track when user enters quiz view
  useEffect(() => {
    if (view === "quiz") {
      setHasEnteredQuiz(true)
      setFilterKey((k) => k + 1)
    }
  }, [view])

  // Load on mount
  useEffect(() => {
    const loaded = loadSubjects()
    setSubjects(loaded)

    const activeId = loadActiveSubject()
    if (activeId && loaded.some((s) => s.id === activeId)) {
      switchSubject(activeId, loaded)
    } else if (loaded.length > 0) {
      switchSubject(loaded[0].id, loaded)
    }
  }, [])


  const persistSubjectData = useCallback(
    (subjId: string, qs: Question[], wrong: string[]) => {
      saveSubjectData(subjId, { questions: qs, wrongIds: wrong })
    },
    []
  )

  const switchSubject = useCallback(
    (id: string, subjList?: Subject[]) => {
      const list = subjList || subjects
      setActiveSubjectId(id)
      saveActiveSubject(id)
      const data = loadSubjectData(id)
      setQuestions(data?.questions || [])
      setWrongIds(data?.wrongIds || [])
      setView("import")
    },
    [subjects]
  )

  const handleCreateSubject = useCallback(
    (name: string) => {
      if (subjects.some((s) => s.name === name)) {
        alert(`科目「${name}」已存在`)
        return
      }
      const newSubj: Subject = {
        id: genId(),
        name,
        createdAt: Date.now(),
      }
      const updated = [...subjects, newSubj]
      setSubjects(updated)
      saveSubjects(updated)
      setActiveSubjectId(newSubj.id)
      saveActiveSubject(newSubj.id)
      setQuestions([])
      setWrongIds([])
      setView("import")
    },
    [subjects]
  )

  const handleDeleteSubject = useCallback(
    (id: string) => {
      const updated = subjects.filter((s) => s.id !== id)
      setSubjects(updated)
      saveSubjects(updated)
      deleteSubject(id)
      if (activeSubjectId === id) {
        if (updated.length > 0) {
          switchSubject(updated[0].id, updated)
        } else {
          setActiveSubjectId(null)
          setQuestions([])
          setWrongIds([])
        }
      }
    },
    [subjects, activeSubjectId, switchSubject]
  )

  const handleRenameSubject = useCallback(
    (id: string, newName: string) => {
      if (subjects.some((s) => s.name === newName && s.id !== id)) {
        alert(`科目「${newName}」已存在`)
        return
      }
      const updated = subjects.map((s) => (s.id === id ? { ...s, name: newName } : s))
      setSubjects(updated)
      saveSubjects(updated)
      renameSubject(id, newName)
    },
    [subjects]
  )

  const handleImport = useCallback(
    (qs: Question[]) => {
      setQuestions(qs)
      setWrongIds([])
      setImportCount((c) => c + 1)
      if (activeSubjectId) {
        saveSubjectData(activeSubjectId, { questions: qs, wrongIds: [] })
      }
      // Stay on import view if some questions lack answers, else go to quiz
      const hasMissing = qs.some((q) => !q.answer)
      setView(hasMissing ? "import" : "quiz")
    },
    [activeSubjectId]
  )

  const handleClearQuestions = useCallback(() => {
    setQuestions([])
    setWrongIds([])
    setView("import")
    if (activeSubjectId) {
      saveSubjectData(activeSubjectId, { questions: [], wrongIds: [] })
    }
  }, [activeSubjectId])

  const handleReset = useCallback(() => {
    setView("import")
    setFocusMode(false)
  }, [])

  const handleUpdateWrong = useCallback(
    (ids: string[]) => {
      setWrongIds(ids)
      if (activeSubjectId) {
        saveSubjectData(activeSubjectId, { questions, wrongIds: ids })
      }
    },
    [activeSubjectId, questions]
  )

  const handleClearWrong = useCallback(() => {
    setWrongIds([])
    if (activeSubjectId) {
      saveSubjectData(activeSubjectId, { questions, wrongIds: [] })
    }
  }, [activeSubjectId, questions])

  const handleRemoveWrong = useCallback((id: string) => {
    setWrongIds((prev) => {
      const newWrongIds = prev.filter((wid) => wid !== id)
      if (activeSubjectId) {
        saveSubjectData(activeSubjectId, { questions, wrongIds: newWrongIds })
      }
      return newWrongIds
    })
  }, [activeSubjectId, questions])

  const handleOpenWrongBook = useCallback(() => {
    if (wrongIds.length > 0) {
      setView("wrong-book")
    }
  }, [wrongIds])

  return (
    <div className="relative">
      {/* Cover - click to dismiss */}
      <CoverPage onDismiss={() => setCoverDismissed(true)} />

      {/* Wallpaper background for app section */}
      <div className="fixed inset-0 z-0">
        <img
          src="/images/BZ.png"
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-background/70" style={{ backdropFilter: "blur(var(--cover-blur, 4px))" }} />
      </div>

      {/* Main App */}
      <div className="relative z-10">
        {/* Gradient bridge from cover to app */}
        <div className="absolute top-0 left-0 right-0 h-48 -translate-y-1/2 bg-gradient-to-b from-transparent to-[hsl(var(--background))] pointer-events-none z-0" />

        <div className="relative z-[1] min-h-screen dot-grid-bg flex">
        {/* Sidebar */}
        <div className={focusMode ? "hidden" : ""}>
          <Sidebar
          subjects={subjects}
          activeSubjectId={activeSubjectId}
          onSelect={(id) => {
            if (activeSubjectId) {
              persistSubjectData(activeSubjectId, questions, wrongIds)
            }
            switchSubject(id)
          }}
          onCreate={handleCreateSubject}
          onDelete={handleDeleteSubject}
          onRename={handleRenameSubject}
          wrongCount={wrongIds.length}
          questionCount={questions.length}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className={`sticky top-0 z-20 w-full px-4 pt-4 lg:px-6 lg:pt-6 ${focusMode ? "hidden" : ""}`}>
            <div className="glass-nav px-5 py-3 flex items-center justify-between rounded-xl">
              <div className="flex items-center gap-3">
                {/* Sidebar toggle (desktop) */}
                <button
                  onClick={() => setSidebarCollapsed((c) => !c)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Menu size={14} strokeWidth={1.5} />
                </button>
                <span className="text-xs font-mono tracking-[0.15em] uppercase font-bold text-foreground">
                  {activeSubjectId
                    ? subjects.find((s) => s.id === activeSubjectId)?.name || "期末复习"
                    : "期末复习"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {questions.length} 题
                </span>
                <ThemeToggle />
                {view === "import" && questions.length > 0 && (
                  <button
                    onClick={() => setView("quiz")}
                    className="bg-accent text-accent-foreground px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {hasEnteredQuiz ? "继续答题" : "开始答题"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <main className={`flex-1 flex relative ${focusMode ? "py-0" : "py-8 lg:py-12"} ${view !== "import" ? "items-stretch" : "items-start justify-center"}`}>
            {/* Import Panel — hidden when in quiz mode but stays mounted */}
            <div className={view === "import" ? "w-full" : "hidden"} key={activeSubjectId ?? "no-subject"}>
              <ImportPanel
                onImport={handleImport}
                onClear={handleClearQuestions}
                questionCount={questions.length}
                wrongCount={wrongIds.length}
                onOpenWrongBook={handleOpenWrongBook}
                questions={questions}
                subjectName={activeSubjectId ? subjects.find((s) => s.id === activeSubjectId)?.name : ""}
              />
            </div>

            {/* Quiz View — hidden when in import mode but stays mounted to preserve state.
                Key changes force remount: "quiz" preserves state, "wrong-book" starts fresh */}
            <div className={`${view !== "import" ? "w-full h-full flex" : "hidden"}`} key={view === "wrong-book" ? "wrong-book" : `quiz-${importCount}`}>
              <QuizView
                questions={questions}
                onReset={handleReset}
                onUpdateWrong={handleUpdateWrong}
                onClearWrong={handleClearWrong}
                onRemoveWrong={handleRemoveWrong}
                wrongIds={wrongIds}
                initialMode={view === "wrong-book" ? "wrong-book" : "normal"}
                focusMode={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                filterKey={filterKey}
              />
            </div>
          </main>
        </div>
      </div>
      </div>
    </div>
  )
}
