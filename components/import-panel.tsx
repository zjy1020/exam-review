"use client"

import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Upload, Wand2, FileText, ExternalLink, Check, Sparkles, Trash2, Download, FileUp, Plus } from "lucide-react"
import { buildFormatPrompt, buildFillPrompt, parseQuestions } from "@/lib/parse-questions"
import type { Question } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import * as mammoth from "mammoth"

interface ImportPanelProps {
  onImport: (questions: Question[]) => void
  onClear: () => void
  questionCount: number
  wrongCount: number
  onOpenWrongBook: () => void
  questions: Question[]
  subjectName?: string
}


function docxHtmlToText(html: string): string {
  let counter = 1
  let text = html
  text = text.replace(/<\/?ol[^>]*>/gi, '')
  text = text.replace(/<li[^>]*>/gi, () => `${counter++}. `)
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#xA0;/g, ' ')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export function ImportPanel({ onImport, onClear, questionCount, wrongCount, onOpenWrongBook, questions, subjectName }: ImportPanelProps) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [showFillDialog, setShowFillDialog] = useState(false)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualType, setManualType] = useState<Question["type"]>("choice")
  const [manualQuestion, setManualQuestion] = useState("")
  const [manualOptions, setManualOptions] = useState<string[]>(["", "", "", ""])
  const [manualAnswer, setManualAnswer] = useState("")
  const [manualExplanation, setManualExplanation] = useState("")
  const [manualChapter, setManualChapter] = useState("")
  const [manualNewChapter, setManualNewChapter] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const readFile = async (file: File) => {
    setFileName(file.name)
    if (file.name.endsWith('.docx')) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const arrayBuffer = ev.target?.result as ArrayBuffer
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setText(docxHtmlToText(result.value || ""))
        } catch {
          setText("")
          alert("无法解析 Word 文件，请确认文件格式正确")
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setText(ev.target?.result as string || "")
      }
      reader.readAsText(file)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readFile(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.docx'))) {
      readFile(file)
    }
  }, [])

  const handleFormatAI = async (platform: "deepseek" | "doubao") => {
    if (!text.trim()) return
    const prompt = buildFormatPrompt(text)
    await navigator.clipboard.writeText(prompt)
    // Clear textarea so user can paste AI result directly when returning
    setText("")
    setFileName("")
    setTimeout(() => {
      setShowAiDialog(false)
      if (platform === "deepseek") {
        window.open("https://chat.deepseek.com", "_blank")
      } else {
        window.open("https://www.doubao.com", "_blank")
      }
    }, 600)
  }

  const handleFillAI = async (platform: "deepseek" | "doubao") => {
    const incomplete = questions.filter(q => !q.answer && !q.explanation)
    if (incomplete.length === 0) return
    const prompt = buildFillPrompt(incomplete)
    await navigator.clipboard.writeText(prompt)
    setTimeout(() => {
      setShowFillDialog(false)
      if (platform === "deepseek") {
        window.open("https://chat.deepseek.com", "_blank")
      } else {
        window.open("https://www.doubao.com", "_blank")
      }
    }, 600)
  }

  const handleImport = () => {
    if (!text.trim()) return
    try {
      const qs = parseQuestions(text)
      console.log("导入结果:", qs.length, "题", qs.slice(0, 2))
      if (qs.length === 0) {
        alert("未能解析出任何题目，请检查格式是否正确")
      }
      onImport(qs)
    } catch (e) {
      console.error("解析出错:", e)
      alert("解析题目时出错: " + (e as Error).message)
    }
  }

  const handleExport = () => {
    if (questions.length === 0) return
    const data = {
      format: "exam-review-questions",
      version: 1,
      subject: subjectName || "未命名题库",
      exportedAt: new Date().toISOString(),
      questions,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${subjectName || "未命名题库"}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        let qs: Question[] = []

        if (data.format === "exam-review-questions") {
          qs = data.questions || []
        } else if (data.questions) {
          qs = data.questions
        } else {
          alert("无法识别的文件格式")
          return
        }

        if (qs.length === 0) {
          alert("文件中没有题目")
          return
        }

        if (confirm(`从「${data.subject || "文件"}」导入 ${qs.length} 题到当前科目？`)) {
          onImport(qs)
        }
      } catch {
        alert("文件解析失败，请确认是正确格式的 JSON 文件")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const incompleteCount = questions.filter(q => !q.answer && !q.explanation).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-7xl mx-auto px-6 lg:px-8"
    >
      {/* File upload area with drag-drop */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all p-12 mb-6 cursor-pointer rounded-xl ${
          isDragOver
            ? "border-accent bg-accent/10"
            : "border-border/60 bg-foreground/[0.02] hover:border-accent/40 hover:bg-accent/5"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".md,.docx"
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Upload size={28} strokeWidth={1.5} />
          <span className="text-sm font-mono">
            {fileName
              ? fileName
              : isDragOver
              ? "松开导入文件"
              : "点击或拖入文件（.md / .docx）"}
          </span>
        </div>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground text-center -mt-4 mb-6">
        Word / MD 的题号仅供参考，原文档如有跳号导入后自动按顺序连续编号
      </p>

      {/* Text area */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="在此粘贴题目内容..."
        className="w-full min-h-[300px] glass bg-transparent text-sm font-mono placeholder:text-muted-foreground/50 resize-y focus-visible:border-accent/50 focus-visible:ring-0 rounded-xl p-6"
      />

      {/* Manual add button */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowManualDialog(true)}
          className="w-full gap-2 text-[10px] font-mono tracking-wider uppercase h-auto py-2 mt-3 border border-dashed border-border/40 hover:border-accent/30 text-muted-foreground hover:text-accent"
        >
          <Plus size={12} strokeWidth={1.5} />
          手动添加题目
        </Button>
      </motion.div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              if (!text.trim()) return
              setShowAiDialog(true)
            }}
            disabled={!text.trim()}
            className="w-full gap-3 text-sm font-mono tracking-wider uppercase h-auto py-4"
          >
            <Wand2 size={18} strokeWidth={1.5} />
            用 AI 格式化
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
          <Button
            size="lg"
            onClick={handleImport}
            disabled={!text.trim()}
            className="w-full gap-3 text-sm font-mono tracking-wider uppercase h-auto py-4"
          >
            <FileText size={14} strokeWidth={1.5} />
            导入题目
          </Button>
        </motion.div>
      </div>

      {/* AI Fill button - for questions missing answers/explanations */}
      {incompleteCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowFillDialog(true)}
            className="w-full gap-3 text-sm font-mono h-auto py-4 border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent"
          >
            <Sparkles size={18} strokeWidth={1.5} />
            AI 补全缺失答案和解析（{incompleteCount} 题）
          </Button>
        </motion.div>
      )}

      {/* Wrong book entry */}
      {wrongCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={onOpenWrongBook}
            className="w-full flex items-center justify-between h-auto py-5 px-5 border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent"
          >
            <span className="text-sm font-mono">错题本</span>
            <span className="text-sm font-mono font-bold">{wrongCount} 题待巩固</span>
          </Button>
        </motion.div>
      )}

      {/* Export / Import (always visible) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground">题库文件</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  disabled={questions.length === 0}
                  className="gap-1 text-[10px] font-mono"
                >
                  <Download size={10} strokeWidth={1.5} />
                  导出
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => importFileRef.current?.click()}
                  className="gap-1 text-[10px] font-mono"
                >
                  <FileUp size={10} strokeWidth={1.5} />
                  导入
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFromFile}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Question count + clear */}
      {questionCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">
                  已导入题库
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono font-bold text-foreground">
                    {questionCount} 题
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("确认清空当前科目的所有题目？")) onClear()
                    }}
                    className="gap-1 text-[10px] font-mono text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                    清空
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Format Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="glass-dialog max-w-sm rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground text-center">
            选择要打开的 AI 平台
          </DialogTitle>
          <div className="flex items-center justify-center gap-1 mt-1 mb-4">
            <Check size={12} className="text-accent" strokeWidth={2} />
            <span className="text-[10px] font-mono text-accent">
              格式化提示已复制到剪贴板
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleFormatAI("deepseek")}
              className="w-full gap-3 text-sm font-mono h-auto py-4"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleFormatAI("doubao")}
              className="w-full gap-3 text-sm font-mono h-auto py-4"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 豆包 并粘贴
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
            粘贴到 AI 对话框，AI 会返回整理好的题目，复制后回来直接粘贴到上方即可
          </p>
          <p className="text-[9px] font-mono text-accent text-center mt-1">
            推荐 DeepSeek，豆包可能出现输出截断
          </p>
        </DialogContent>
      </Dialog>

      {/* AI Fill Dialog */}
      <Dialog open={showFillDialog} onOpenChange={setShowFillDialog}>
        <DialogContent className="glass-dialog max-w-sm rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground text-center">
            选择要打开的 AI 平台
          </DialogTitle>
          <div className="flex items-center justify-center gap-1 mt-1 mb-4">
            <Check size={12} className="text-accent" strokeWidth={2} />
            <span className="text-[10px] font-mono text-accent">
              补全提示已复制到剪贴板
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleFillAI("deepseek")}
              className="w-full gap-3 text-sm font-mono h-auto py-4"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleFillAI("doubao")}
              className="w-full gap-3 text-sm font-mono h-auto py-4"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 豆包 并粘贴
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
            AI 会补全答案和解析，把返回结果粘贴到上方重新导入即可
          </p>
          <p className="text-[9px] font-mono text-accent text-center mt-1">
            推荐 DeepSeek，豆包可能出现输出截断
          </p>
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={showManualDialog} onOpenChange={(open) => {
        setShowManualDialog(open)
        if (!open) {
          setManualQuestion("")
          setManualOptions(["", "", "", ""])
          setManualAnswer("")
          setManualExplanation("")
          setManualChapter("")
          setManualType("choice")
        }
      }}>
        <DialogContent className="glass-dialog max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xs font-mono tracking-wider uppercase text-foreground text-center">
            手动添加题目
          </DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">题型</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {([["choice", "选择题"], ["multiple", "多选题"], ["truefalse", "判断题"], ["input", "填空题"], ["essay", "简答题"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => {
                      setManualType(val)
                      setManualAnswer("")
                      if (val === "truefalse") setManualOptions(["对", "错"])
                      else if (val === "choice" && manualOptions.filter(Boolean).length < 2) setManualOptions(["", "", "", ""])
                      else if (val === "multiple" && manualOptions.filter(Boolean).length < 2) setManualOptions(["", "", "", ""])
                      else if (val !== "choice" && val !== "multiple") setManualOptions([])
                    }}
                    className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                      manualType === val
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
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
                placeholder="输入题目内容..."
                className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50 min-h-[60px]"
              />
            </div>

            {(manualType === "choice" || manualType === "multiple") && (
              <div>
                <Label className="text-[10px] font-mono text-muted-foreground">选项</Label>
                <div className="space-y-1.5 mt-1.5">
                  {manualOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const next = [...manualOptions]
                          next[i] = e.target.value
                          setManualOptions(next)
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                        className="flex-1 px-2 py-1.5 text-[11px] font-mono bg-transparent border border-border/40 rounded-md focus:outline-none focus:border-accent/50"
                      />
                      {manualOptions.length > 2 && (
                        <button
                          onClick={() => setManualOptions(manualOptions.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive text-[10px]"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setManualOptions([...manualOptions, ""])}
                    className="text-[10px] font-mono text-accent hover:text-accent/80 mt-1"
                  >
                    + 添加选项
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">答案</Label>
              {manualType === "truefalse" ? (
                <div className="flex gap-2 mt-1.5">
                  {["对", "错"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setManualAnswer(v)}
                      className={`px-4 py-2 text-[11px] font-mono rounded-lg border transition-colors ${
                        manualAnswer === v
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border/40 text-muted-foreground hover:border-accent/30"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : manualType === "choice" ? (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {manualOptions.filter(Boolean).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setManualAnswer(String.fromCharCode(65 + i))}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                        manualAnswer === String.fromCharCode(65 + i)
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border/40 text-muted-foreground hover:border-accent/30"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
              ) : manualType === "multiple" ? (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {manualOptions.filter(Boolean).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const letter = String.fromCharCode(65 + i)
                        const current = manualAnswer.split("")
                        const next = current.includes(letter)
                          ? current.filter(c => c !== letter).join("")
                          : [...current, letter].sort().join("")
                        setManualAnswer(next)
                      }}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-colors ${
                        manualAnswer.includes(String.fromCharCode(65 + i))
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
                  value={manualAnswer}
                  onChange={(e) => setManualAnswer(e.target.value)}
                  placeholder="输入答案..."
                  rows={5}
                  className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50"
                />
              )}
            </div>

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">解析（可选）</Label>
              <textarea
                value={manualExplanation}
                onChange={(e) => setManualExplanation(e.target.value)}
                placeholder="输入解析..."
                className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg resize-y focus:outline-none focus:border-accent/50 min-h-[40px]"
              />
            </div>

            <div>
              <Label className="text-[10px] font-mono text-muted-foreground">章节（可选）</Label>
              {!manualNewChapter ? (
                <select
                  value={manualChapter}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setManualNewChapter(true)
                      setManualChapter("")
                    } else {
                      setManualChapter(e.target.value)
                    }
                  }}
                  className="w-full mt-1.5 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg focus:outline-none focus:border-accent/50 [&>option]:bg-background"
                >
                  <option value="">不选择</option>
                  {Array.from(new Set(questions.map((q) => q.chapter).filter(Boolean))).map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                  <option value="__new__">新建章节...</option>
                </select>
              ) : (
                <div className="flex gap-2 items-center mt-1.5">
                  <input
                    value={manualChapter}
                    onChange={(e) => setManualChapter(e.target.value)}
                    placeholder="输入新章节名称"
                    autoFocus
                    className="flex-1 px-3 py-2 text-xs font-mono bg-transparent border border-border/40 rounded-lg focus:outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={() => { setManualNewChapter(false); setManualChapter("") }}
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
                if (!manualQuestion.trim()) return
                if ((manualType === "choice" || manualType === "multiple") && manualOptions.filter(Boolean).length < 2) return
                if (!manualAnswer.trim() && manualType !== "multiple") return
                if (manualType === "multiple" && !manualAnswer.trim()) return

                const maxNum = questions.reduce((m, q) => Math.max(m, q.number), 0)
                const newQuestion: Question = {
                  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  number: maxNum + 1,
                  question: manualQuestion.trim(),
                  options: (manualType === "choice" || manualType === "multiple") ? manualOptions.filter(Boolean) : [],
                  answer: (() => {
                    const ans = manualAnswer.trim()
                    if (/^[A-Da-d]$/.test(ans) && manualType === "choice") {
                      const opts = manualOptions.filter(Boolean)
                      return opts[ans.toUpperCase().charCodeAt(0) - 65] || ans
                    }
                    return ans
                  })(),
                  explanation: manualExplanation.trim(),
                  chapter: manualChapter.trim() || undefined,
                  type: manualType,
                }
                onImport([...questions, newQuestion])
                setShowManualDialog(false)
                setManualQuestion("")
                setManualOptions(["", "", "", ""])
                setManualAnswer("")
                setManualExplanation("")
                setManualChapter("")
                setManualType("choice")
              }}
              disabled={
                !manualQuestion.trim() ||
                ((manualType === "choice" || manualType === "multiple") && manualOptions.filter(Boolean).length < 2) ||
                !manualAnswer.trim()
              }
              className="w-full gap-2 text-xs font-mono tracking-wider uppercase h-auto py-4"
            >
              <Plus size={14} strokeWidth={1.5} />
              添加题目
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
