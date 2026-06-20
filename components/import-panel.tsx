"use client"

import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Upload, Wand2, FileText, ExternalLink, Check, Sparkles } from "lucide-react"
import { buildFormatPrompt, buildFillPrompt } from "@/lib/parse-questions"
import type { Question } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

interface ImportPanelProps {
  onImport: (questions: Question[]) => void
  questionCount: number
  wrongCount: number
  onOpenWrongBook: () => void
  questions: Question[]
}

export function ImportPanel({ onImport, questionCount, wrongCount, onOpenWrongBook, questions }: ImportPanelProps) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [showFillDialog, setShowFillDialog] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setText(ev.target?.result as string || "")
    }
    reader.readAsText(file)
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
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      readFile(file)
    }
  }, [])

  const handleFormatAI = async (platform: "deepseek" | "doubao") => {
    if (!text.trim()) return
    const prompt = buildFormatPrompt(text)
    await navigator.clipboard.writeText(prompt)
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
    import("@/lib/parse-questions").then(({ parseQuestions }) => {
      const qs = parseQuestions(text)
      onImport(qs)
    })
  }

  const incompleteCount = questions.filter(q => !q.answer && !q.explanation).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-6xl mx-auto px-4"
    >
      {/* File upload area with drag-drop */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-colors p-6 mb-4 cursor-pointer ${
          isDragOver
            ? "border-accent bg-accent/5"
            : "border-foreground/20 hover:border-foreground/40"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload size={20} strokeWidth={1.5} />
          <span className="text-xs font-mono">
            {fileName
              ? fileName
              : isDragOver
              ? "松开导入文件"
              : "点击或拖入文件（.md / .txt）"}
          </span>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="在此粘贴题目内容..."
        className="w-full h-64 border border-foreground/20 bg-foreground/5 p-4 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 resize-y outline-none focus:border-foreground/40 transition-colors"
      />

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (!text.trim()) return
            setShowAiDialog(true)
          }}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-2 border border-foreground/20 bg-foreground/5 px-4 py-3 text-xs font-mono tracking-wider uppercase text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30"
        >
          <Wand2 size={14} strokeWidth={1.5} />
          用 AI 格式化
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleImport}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background px-4 py-3 text-xs font-mono tracking-wider uppercase hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          <FileText size={14} strokeWidth={1.5} />
          导入题目
        </motion.button>
      </div>

      {/* AI Fill button - for questions missing answers/explanations */}
      {incompleteCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <button
            onClick={() => setShowFillDialog(true)}
            className="w-full flex items-center justify-center gap-2 border border-accent/30 bg-accent/5 px-4 py-2.5 text-xs font-mono text-accent hover:bg-accent/10 transition-colors"
          >
            <Sparkles size={14} strokeWidth={1.5} />
            AI 补全缺失答案和解析（{incompleteCount} 题）
          </button>
        </motion.div>
      )}

      {/* Wrong book entry */}
      {wrongCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <button
            onClick={onOpenWrongBook}
            className="w-full flex items-center justify-between p-4 border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors"
          >
            <span className="text-xs font-mono text-accent">错题本</span>
            <span className="text-xs font-mono text-accent font-bold">{wrongCount} 题待巩固</span>
          </button>
        </motion.div>
      )}

      {/* Question count indicator */}
      {questionCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-4 border border-foreground/20 bg-foreground/5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">
              已导入题库
            </span>
            <span className="text-sm font-mono font-bold text-foreground">
              {questionCount} 题
            </span>
          </div>
        </motion.div>
      )}

      {/* AI Format Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="border border-foreground/20 bg-background dot-grid-bg max-w-sm">
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
            <button
              onClick={() => handleFormatAI("deepseek")}
              className="flex items-center justify-center gap-2 border border-foreground/20 px-4 py-3 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors"
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </button>
            <button
              onClick={() => handleFormatAI("doubao")}
              className="flex items-center justify-center gap-2 border border-foreground/20 px-4 py-3 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors"
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              打开 豆包 并粘贴
            </button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
            粘贴到 AI 对话框，AI 会返回整理好的统一格式题目
          </p>
          <p className="text-[9px] font-mono text-accent text-center mt-1">
            推荐 DeepSeek，豆包可能出现输出截断
          </p>
        </DialogContent>
      </Dialog>

      {/* AI Fill Dialog */}
      <Dialog open={showFillDialog} onOpenChange={setShowFillDialog}>
        <DialogContent className="border border-foreground/20 bg-background dot-grid-bg max-w-sm">
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
            <button
              onClick={() => handleFillAI("deepseek")}
              className="flex items-center justify-center gap-2 border border-foreground/20 px-4 py-3 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors"
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </button>
            <button
              onClick={() => handleFillAI("doubao")}
              className="flex items-center justify-center gap-2 border border-foreground/20 px-4 py-3 text-xs font-mono text-foreground hover:bg-foreground/5 transition-colors"
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              打开 豆包 并粘贴
            </button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">
            AI 会补全答案和解析，把返回结果粘贴到上方重新导入即可
          </p>
          <p className="text-[9px] font-mono text-accent text-center mt-1">
            推荐 DeepSeek，豆包可能出现输出截断
          </p>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
