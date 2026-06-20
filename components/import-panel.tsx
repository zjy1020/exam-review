"use client"

import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Upload, Wand2, FileText, ExternalLink, Check, Sparkles, Trash2 } from "lucide-react"
import { buildFormatPrompt, buildFillPrompt, parseQuestions } from "@/lib/parse-questions"
import type { Question } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import * as mammoth from "mammoth"

interface ImportPanelProps {
  onImport: (questions: Question[]) => void
  onClear: () => void
  questionCount: number
  wrongCount: number
  onOpenWrongBook: () => void
  questions: Question[]
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

export function ImportPanel({ onImport, onClear, questionCount, wrongCount, onOpenWrongBook, questions }: ImportPanelProps) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [showFillDialog, setShowFillDialog] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="在此粘贴题目内容..."
        className="w-full min-h-[300px] glass p-6 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-y outline-none focus:border-accent/50 transition-all rounded-xl"
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
          className="flex-1 flex items-center justify-center gap-3 border border-border/60 bg-background/60 backdrop-blur-sm px-6 py-4 text-sm font-mono tracking-wider uppercase text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all disabled:opacity-30 rounded-xl"
        >
          <Wand2 size={18} strokeWidth={1.5} />
          用 AI 格式化
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleImport}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-3 bg-accent text-accent-foreground px-6 py-4 text-sm font-mono tracking-wider uppercase hover:opacity-90 transition-opacity disabled:opacity-30 rounded-xl"
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
            className="w-full flex items-center justify-center gap-3 border border-accent/30 bg-accent/5 px-6 py-4 text-sm font-mono text-accent hover:bg-accent/10 transition-all rounded-xl"
          >
            <Sparkles size={18} strokeWidth={1.5} />
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
            className="w-full flex items-center justify-between p-5 border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-all rounded-xl"
          >
            <span className="text-sm font-mono text-accent">错题本</span>
            <span className="text-sm font-mono text-accent font-bold">{wrongCount} 题待巩固</span>
          </button>
        </motion.div>
      )}

      {/* Question count indicator */}
      {questionCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-5 glass-card rounded-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">
              已导入题库
            </span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-foreground">
                {questionCount} 题
              </span>
              <button
                onClick={() => {
                  if (confirm("确认清空当前科目的所有题目？")) onClear()
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-muted-foreground hover:text-destructive border border-border/60 hover:border-destructive/50 transition-all rounded-md"
              >
                <Trash2 size={10} strokeWidth={1.5} />
                清空
              </button>
            </div>
          </div>
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
            <button
              onClick={() => handleFormatAI("deepseek")}
              className="flex items-center justify-center gap-3 border border-border/60 bg-foreground/5 px-6 py-4 text-sm font-mono text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all rounded-lg"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </button>
            <button
              onClick={() => handleFormatAI("doubao")}
              className="flex items-center justify-center gap-3 border border-border/60 bg-foreground/5 px-6 py-4 text-sm font-mono text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all rounded-lg"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 豆包 并粘贴
            </button>
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
            <button
              onClick={() => handleFillAI("deepseek")}
              className="flex items-center justify-center gap-3 border border-border/60 bg-foreground/5 px-6 py-4 text-sm font-mono text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all rounded-lg"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
              打开 DeepSeek 并粘贴
            </button>
            <button
              onClick={() => handleFillAI("doubao")}
              className="flex items-center justify-center gap-3 border border-border/60 bg-foreground/5 px-6 py-4 text-sm font-mono text-foreground hover:bg-accent/10 hover:border-accent/30 transition-all rounded-lg"
            >
              <ExternalLink size={18} strokeWidth={1.5} />
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
