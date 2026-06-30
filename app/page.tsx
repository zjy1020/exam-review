"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ImportPanel } from "@/components/import-panel"
import { QuizView } from "@/components/quiz-view"
import { Sidebar } from "@/components/sidebar"
import { CoverPage } from "@/components/cover-page"
import { ThemeToggle } from "@/components/theme-toggle"
import { Menu, ChevronRight, BookOpen, ImageIcon, Upload, Check, X } from "lucide-react"
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

function parseBg(bg: string) {
  if (bg === "none|") return { type: "none" as const, value: "" }
  const pipe = bg.indexOf("|")
  if (pipe === -1) return { type: "image" as const, value: bg }
  return { type: bg.substring(0, pipe) as "image" | "gradient" | "custom" | "video", value: bg.substring(pipe + 1) }
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
  const [wrongBookKey, setWrongBookKey] = useState(0)
  const [showAppBgPicker, setShowAppBgPicker] = useState(false)
  const appBgBtnRef = useRef<HTMLButtonElement>(null)
  const appBgGridRef = useRef<HTMLDivElement>(null)
  const [appBg, setAppBg] = useState("image|/images/BZ.png")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const bgRef = useRef(appBg)
  const bgUploadRef = useRef<HTMLInputElement>(null)

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type === "video/mp4") {
      const url = URL.createObjectURL(file)
      localStorage.setItem("quiz-bg", `video|${url}`)
      setAppBg(`video|${url}`)
      setShowAppBgPicker(false)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        localStorage.setItem("quiz-bg", `custom|${dataUrl}`)
        setAppBg(`custom|${dataUrl}`)
        setShowAppBgPicker(false)
      }
      reader.readAsDataURL(file)
    }
  }
  const appBgPresets = [
    { id: "none", name: "无壁纸", value: "none" },
    { id: "bz", name: "默认", value: "/images/BZ.png" },
    { id: "lumen", name: "Lumen骑士", value: "/images/wp-lumen.png" },
    { id: "anime-girl", name: "动漫女孩", value: "/images/wp-anime-girl.png" },
    { id: "catfeather", name: "猫羽雫", value: "/images/wp-catfeather.png" },
    { id: "onepiece", name: "海贼王", value: "/images/wp-onepiece.png" },
    { id: "ragdoll", name: "布偶猫", value: "/images/wp-ragdoll.png" },
    { id: "wlop-sea", name: "WLOP大海", value: "/images/wp-wlop-sea.png" },
    { id: "cg-art", name: "CG插画", value: "/images/wp-cg-art.png" },
    { id: "dark-slate", name: "深空蓝", value: "grad" },
    { id: "warm-amber", name: "暖琥珀", value: "grad" },
    { id: "cool-teal", name: "冷松绿", value: "grad" },
    { id: "royal-purple", name: "皇家紫", value: "grad" },
    { id: "charcoal", name: "炭黑", value: "grad" },
    { id: "blood-orange", name: "血橙", value: "grad" },
  ]

  useEffect(() => {
    const stored = localStorage.getItem("quiz-bg")
    if (stored && stored !== "image|/images/BZ.png" && stored !== "video|/images/wp-coffee-mv.mp4") { setAppBg(stored); bgRef.current = stored }
    const iv = setInterval(() => {
      const updated = localStorage.getItem("quiz-bg")
      if (updated && updated !== bgRef.current && updated !== "image|/images/BZ.png" && updated !== "video|/images/wp-coffee-mv.mp4") { setAppBg(updated); bgRef.current = updated }
    }, 800)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => { setHasEnteredQuiz(false) }, [importCount])

  useEffect(() => {
    if (view === "quiz") { setHasEnteredQuiz(true); setFilterKey((k) => k + 1) }
  }, [view])

  useEffect(() => {
    const loaded = loadSubjects()
    setSubjects(loaded)
    const activeId = loadActiveSubject()
    if (activeId && loaded.some((s) => s.id === activeId)) { switchSubject(activeId, loaded) }
    else if (loaded.length > 0) { switchSubject(loaded[0].id, loaded) }
  }, [])

  const persistSubjectData = useCallback((subjId: string, qs: Question[], wrong: string[]) => {
    saveSubjectData(subjId, { questions: qs, wrongIds: wrong })
  }, [])

  const switchSubject = useCallback((id: string, subjList?: Subject[]) => {
    const list = subjList || subjects
    setActiveSubjectId(id)
    saveActiveSubject(id)
    const data = loadSubjectData(id)
    setQuestions(data?.questions || [])
    setWrongIds(data?.wrongIds || [])
    setView("import")
  }, [subjects])

  const handleCreateSubject = useCallback((name: string) => {
    if (subjects.some((s) => s.name === name)) { alert(`科目「${name}」已存在`); return }
    const newSubj: Subject = { id: genId(), name, createdAt: Date.now() }
    const updated = [...subjects, newSubj]
    setSubjects(updated); saveSubjects(updated)
    setActiveSubjectId(newSubj.id); saveActiveSubject(newSubj.id)
    setQuestions([]); setWrongIds([]); setView("import")
  }, [subjects])

  const handleDeleteSubject = useCallback((id: string) => {
    const updated = subjects.filter((s) => s.id !== id)
    setSubjects(updated); saveSubjects(updated); deleteSubject(id)
    if (activeSubjectId === id) {
      if (updated.length > 0) switchSubject(updated[0].id, updated)
      else { setActiveSubjectId(null); setQuestions([]); setWrongIds([]) }
    }
  }, [subjects, activeSubjectId, switchSubject])

  const handleRenameSubject = useCallback((id: string, newName: string) => {
    if (subjects.some((s) => s.name === newName && s.id !== id)) { alert(`科目「${newName}」已存在`); return }
    const updated = subjects.map((s) => (s.id === id ? { ...s, name: newName } : s))
    setSubjects(updated); saveSubjects(updated); renameSubject(id, newName)
  }, [subjects])

  const handleImport = useCallback((qs: Question[]) => {
    setQuestions(qs); setWrongIds([]); setImportCount((c) => c + 1)
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions: qs, wrongIds: [] })
    setView(qs.some((q) => !q.answer) ? "import" : "quiz")
  }, [activeSubjectId])

  const handleClearQuestions = useCallback(() => {
    setQuestions([]); setWrongIds([]); setView("import")
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions: [], wrongIds: [] })
  }, [activeSubjectId])

  const handleReset = useCallback(() => { setView("import"); setFocusMode(false) }, [])
  const handleUpdateWrong = useCallback((ids: string[]) => {
    setWrongIds(ids)
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions, wrongIds: ids })
  }, [activeSubjectId, questions])
  const handleClearWrong = useCallback(() => {
    setWrongIds([])
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions, wrongIds: [] })
  }, [activeSubjectId, questions])
  const handleRemoveWrong = useCallback((id: string) => {
    setWrongIds((prev) => { const n = prev.filter((wid) => wid !== id); if (activeSubjectId) saveSubjectData(activeSubjectId, { questions, wrongIds: n }); return n })
  }, [activeSubjectId, questions])
  const handleUpdateQuestion = useCallback((updated: Question) => {
    const n = questions.map((q) => q.id === updated.id ? updated : q); setQuestions(n)
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions: n, wrongIds })
  }, [activeSubjectId, questions, wrongIds])
  const handleAddQuestion = useCallback((q: Question) => {
    const n = [...questions, q]; setQuestions(n)
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions: n, wrongIds })
  }, [activeSubjectId, questions, wrongIds])
  const handleDeleteQuestion = useCallback((id: string) => {
    const n = questions.filter((q) => q.id !== id); setQuestions(n)
    if (activeSubjectId) saveSubjectData(activeSubjectId, { questions: n, wrongIds })
  }, [activeSubjectId, questions, wrongIds])
  const handleOpenWrongBook = useCallback(() => { if (wrongIds.length > 0) setView("wrong-book") }, [wrongIds])

  const bgStyle = parseBg(appBg)
  const activeSubject = activeSubjectId ? subjects.find((s) => s.id === activeSubjectId) : null
  const isMobileSidebar = typeof window !== "undefined" && window.innerWidth < 1024

  return (
    <div className="relative min-h-screen">
      {!coverDismissed && <CoverPage onDismiss={() => setCoverDismissed(true)} />}

      {/* Background layer */}
      <div className="fixed inset-0 z-0">
        {bgStyle.type === "none" || !bgStyle.value ? null : bgStyle.type === "video" ? (
          <video src={bgStyle.value} autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover" />
        ) : bgStyle.type === "image" || bgStyle.type === "custom" ? (
          <img src={bgStyle.value} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full" style={{ background: bgStyle.value }} />
        )}
        <div className="absolute inset-0 bg-background/40" style={{ backdropFilter: "blur(var(--cover-blur, 4px))" }} />
      </div>

      {/* Main layout */}
      <div className="relative z-10 flex min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden lg:block sticky top-0 h-screen">
          <Sidebar
            subjects={subjects}
            activeSubjectId={activeSubjectId}
            onSelect={(id) => {
              if (activeSubjectId) persistSubjectData(activeSubjectId, questions, wrongIds)
              switchSubject(id)
            }}
            onCreate={handleCreateSubject}
            onDelete={handleDeleteSubject}
            onRename={handleRenameSubject}
            wrongCount={wrongIds.length}
            questionCount={questions.length}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            onSetCollapsed={setSidebarCollapsed}
          />
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar — redesigned */}
          <header className="sticky top-0 z-20 w-full">
            <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 px-4 sm:px-5 py-2.5 rounded-2xl border border-border/30 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                {/* Left */}
                <div className="flex items-center gap-3">
                  {/* Mobile sidebar toggle */}
                  <button
                    onClick={() => setSidebarCollapsed((c) => !c)}
                    className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Menu size={16} strokeWidth={1.5} />
                  </button>

                  {/* Desktop sidebar toggle */}
                  <button
                    onClick={() => setSidebarCollapsed((c) => !c)}
                    className="hidden lg:flex text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={1.5} /> : <Menu size={14} strokeWidth={1.5} />}
                  </button>

                  {/* Divider */}
                  <div className="h-4 w-px bg-border/50 hidden sm:block" />

                  {/* Subject name */}
                  <div className="flex items-center gap-2">
                    <BookOpen size={13} className="text-accent hidden sm:block" strokeWidth={1.5} />
                    <span className="text-xs sm:text-sm font-medium tracking-tight text-foreground">
                      {activeSubject?.name || "期末复习"}
                    </span>
                  </div>

                  {/* Question count chip */}
                  {questions.length > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-mono text-muted-foreground">
                      {questions.length} 题
                    </span>
                  )}
                </div>

                {/* Right */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Wrong book chip */}
                  {wrongIds.length > 0 && (
                    <button
                      onClick={() => handleOpenWrongBook()}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-mono hover:bg-red-500/20 transition-colors"
                    >
                      错题 {wrongIds.length}
                    </button>
                  )}

                  {/* View toggle */}
                  {view === "import" && questions.length > 0 && (
                    <button
                      onClick={() => setView("quiz")}
                      className="bg-accent text-accent-foreground px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity font-medium"
                    >
                      {hasEnteredQuiz ? "继续答题" : "开始答题"}
                    </button>
                  )}

                  <div className="h-4 w-px bg-border/40 hidden sm:block" />

                  <div className="relative">
                    <button ref={appBgBtnRef} onClick={() => setShowAppBgPicker(p => !p)}
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all">
                      <ImageIcon size={13} strokeWidth={1.5} />
                    </button>
                    {showAppBgPicker && (
                      <div ref={appBgGridRef}
                        className="absolute top-10 right-0 z-30 w-[320px] max-h-[420px] overflow-y-auto rounded-2xl border border-border/50 bg-background/90 backdrop-blur-2xl p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase">背景切换</span>
                          <button onClick={() => setShowAppBgPicker(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} strokeWidth={1.5} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {appBgPresets.map((p) => {
                            const curVal = appBg.split("|").slice(1).join("|")
                            const isGrad = p.value === "grad"
                            const isVideo = p.value.endsWith(".mp4")
                            const isActive = p.id === "none" ? (curVal === "" || curVal === "none") : isGrad ? curVal.includes("linear-gradient") && curVal.includes(p.name) : isVideo ? curVal === p.value : curVal === p.value
                            return (
                              <div key={p.id} className="relative">
                                <button onClick={() => {
                                  if (p.id === "none") { localStorage.setItem("quiz-bg", "none|"); setAppBg("none|") } else if (isGrad) {
                                    const gradMap: Record<string, string> = {
                                      "深空蓝": "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
                                      "暖琥珀": "linear-gradient(135deg, #1a0a00 0%, #4a1a00 50%, #1a0a00 100%)",
                                      "冷松绿": "linear-gradient(135deg, #001a1a 0%, #003d33 50%, #001a1a 100%)",
                                      "皇家紫": "linear-gradient(135deg, #0d001a 0%, #2d004d 50%, #0d001a 100%)",
                                      "炭黑": "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
                                      "血橙": "linear-gradient(135deg, #1a0500 0%, #4a1000 50%, #1a0500 100%)",
                                    }
                                    const val = gradMap[p.name]
                                    localStorage.setItem("quiz-bg", `gradient|${val}`)
                                    setAppBg(`gradient|${val}`)
                                  } else if (isVideo) {
                                    localStorage.setItem("quiz-bg", `video|${p.value}`)
                                    setAppBg(`video|${p.value}`)
                                  } else {
                                    localStorage.setItem("quiz-bg", `image|${p.value}`)
                                    setAppBg(`image|${p.value}`)
                                  }
                                  setShowAppBgPicker(false)
                                }} className={`relative w-full aspect-[3/2] rounded-lg overflow-hidden border-2 transition-all ${isActive ? "border-accent ring-1 ring-accent/50" : "border-border/40 hover:border-foreground/30"}`}>
                                  {p.id === "none" ? (
                                    <div className="w-full h-full bg-background/40 flex items-center justify-center rounded-sm border border-dashed border-border/40">
                                      <span className="text-[10px] font-mono text-muted-foreground/30">OFF</span>
                                    </div>
                                  ) : isGrad ? (
                                    <div className="w-full h-full" style={{ background: p.name === "深空蓝" ? "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" : p.name === "暖琥珀" ? "linear-gradient(135deg, #1a0a00 0%, #4a1a00 50%, #1a0a00 100%)" : p.name === "冷松绿" ? "linear-gradient(135deg, #001a1a 0%, #003d33 50%, #001a1a 100%)" : p.name === "皇家紫" ? "linear-gradient(135deg, #0d001a 0%, #2d004d 50%, #0d001a 100%)" : p.name === "炭黑" ? "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)" : "linear-gradient(135deg, #1a0500 0%, #4a1000 50%, #1a0500 100%)" }} />
                                  ) : isVideo ? (
                                    <video src={p.value} className="w-full h-full object-cover" muted preload="auto" />
                                  ) : (
                                    <img src={p.value} alt={p.name} className="w-full h-full object-cover" />
                                  )}
                                  {isActive && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Check size={16} className="text-accent" strokeWidth={3} /></div>}
                                </button>
                                <p className="text-[9px] font-mono text-muted-foreground text-center mt-1 truncate">{p.name}</p>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <button onClick={() => bgUploadRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border/40 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all">
                            <Upload size={12} strokeWidth={1.5} />
                            上传自定义图片
                          </button>
                          <input ref={bgUploadRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={handleBgUpload} />
                        </div>
                      </div>
                    )}
                    </div>
                    <button onClick={() => setCoverDismissed(false)}
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                      title="返回封面">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z"/><path d="m9 14 2 2 4-4"/></svg>
                    </button>
                    <ThemeToggle />
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className={`flex-1 flex relative ${focusMode ? "py-0" : "py-6 sm:py-8 lg:py-10 px-3 sm:px-4 lg:px-6"} ${view !== "import" ? "items-stretch" : "items-start justify-center"}`}>
            <div className={view === "import" ? "w-full max-w-4xl" : "hidden"} key={activeSubjectId ?? "no-subject"}>
              <ImportPanel
                onImport={handleImport}
                onClear={handleClearQuestions}
                questionCount={questions.length}
                wrongCount={wrongIds.length}
                onOpenWrongBook={handleOpenWrongBook}
                questions={questions}
                subjectName={activeSubject?.name || ""}
              />
            </div>

            <div className={`${view !== "import" ? "w-full h-full flex" : "hidden"}`} key={view === "wrong-book" ? `wb-${wrongBookKey}` : `quiz-${importCount}`}>
              <QuizView
                questions={questions}
                onReset={handleReset}
                onUpdateWrong={handleUpdateWrong}
                onClearWrong={handleClearWrong}
                onRemoveWrong={handleRemoveWrong}
                onUpdateQuestion={handleUpdateQuestion}
                onAddQuestion={handleAddQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                wrongIds={wrongIds}
                initialMode={view === "wrong-book" ? "wrong-book" : "normal"}
                focusMode={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                filterKey={filterKey}
                subjectId={activeSubjectId || undefined}
              />
            </div>
          </main>
        </div>
      </div>


    </div>
  )
}






