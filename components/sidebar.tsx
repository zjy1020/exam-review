"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { BookOpen, Plus, Trash2, ChevronLeft, Pencil, FileText, BookX } from "lucide-react"
import type { Subject } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface SidebarProps {
  subjects: Subject[]
  activeSubjectId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
  wrongCount: number
  questionCount: number
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({
  subjects,
  activeSubjectId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  wrongCount,
  questionCount,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [showNewInput, setShowNewInput] = useState(false)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const sidebarImportRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim())
      setNewName("")
      setShowNewInput(false)
    }
  }

  const startRename = (s: Subject) => {
    setEditingId(s.id)
    setEditName(s.name)
  }

  const handleRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName("")
  }

  const sidebarContent = (
    <div className="min-w-[240px] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
        <span className="text-xs font-mono tracking-[0.15em] uppercase font-bold text-foreground">
          科目列表
        </span>
        <div className="hidden lg:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Subject list */}
      <ScrollArea className="flex-1 py-2">
        {subjects.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs font-mono text-muted-foreground">
              暂无科目
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              点击下方新建
            </p>
          </div>
        )}
        {subjects.map((s) => (
          <div key={s.id} className="px-2">
            {editingId === s.id ? (
              <div className="flex gap-1 px-1 py-1">
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename()
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  autoFocus
                  className="h-7 text-xs font-mono border-accent/50"
                />
                <Button
                  onClick={handleRename}
                  size="sm"
                  className="text-xs font-mono h-7"
                >
                  确定
                </Button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onSelect(s.id)
                  if (window.innerWidth < 1024) onToggle()
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-left transition-all duration-200 border-l-2 group rounded-r-lg ${
                  activeSubjectId === s.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/5 hover:border-l-accent/30"
                }`}
              >
                <BookOpen size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate flex-1">{s.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(s)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-accent transition-all cursor-pointer"
                >
                  <Pencil size={10} strokeWidth={1.5} />
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`删除科目「${s.name}」？`)) onDelete(s.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                >
                  <Trash2 size={10} strokeWidth={1.5} />
                </span>
              </button>
            )}
          </div>
        ))}
      </ScrollArea>

      {/* Stats */}
      {activeSubjectId && (
        <div className="px-4 py-2 border-t border-foreground/10 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText size={10} strokeWidth={1.5} />
              题目
            </span>
            <span>{questionCount}</span>
          </div>
          {wrongCount > 0 && (
            <div className="flex items-center justify-between text-xs font-mono text-accent">
              <span className="flex items-center gap-1">
                <BookX size={10} strokeWidth={1.5} />
                错题
              </span>
              <span>{wrongCount}</span>
            </div>
          )}
        </div>
      )}

      {/* New subject */}
      <div className="px-3 py-3 border-t border-foreground/10">
        {showNewInput ? (
          <div className="flex gap-1">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
                if (e.key === "Escape") setShowNewInput(false)
              }}
              placeholder="科目名称"
              autoFocus
              className="h-8 text-xs font-mono"
            />
            <Button
              onClick={handleCreate}
              size="sm"
              className="text-xs font-mono h-8"
            >
              确定
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewInput(true)}
            className="w-full gap-1.5 border-dashed text-xs font-mono"
          >
            <Plus size={12} strokeWidth={1.5} />
            新建科目
          </Button>
        )}
      </div>

      {/* Export / Import */}
      <div className="px-3 py-3 border-t border-foreground/10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const data: Record<string, unknown> = {}
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith("quiz-")) {
                const val = localStorage.getItem(key) || ""
                try { data[key] = JSON.parse(val) } catch { data[key] = val }
              }
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `exam-review-backup-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex-1 gap-1 text-xs font-mono"
        >
          导出数据
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebarImportRef.current?.click()}
          className="flex-1 gap-1 text-xs font-mono"
        >
          导入数据
        </Button>
        <input
          ref={sidebarImportRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = (ev) => {
              try {
                const data = JSON.parse(ev.target?.result as string)
                let count = 0
                for (const [key, val] of Object.entries(data)) {
                  if (typeof val === "string") {
                    localStorage.setItem(key, val)
                    count++
                  } else if (typeof val === "object" && val !== null) {
                    localStorage.setItem(key, JSON.stringify(val))
                    count++
                  }
                }
                if (confirm(`已导入 ${count} 项数据，是否刷新页面？`)) {
                  window.location.reload()
                }
              } catch {
                alert("文件格式错误")
              }
            }
            reader.readAsText(file)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Sheet */}
      <div className="lg:hidden">
        <Sheet open={!collapsed} onOpenChange={(open) => { if (!open) onToggle() }}>
          <SheetContent side="left" className="w-[240px] p-0">
            <SheetTitle className="sr-only">科目列表</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 0 : 240 }}
        className="h-full glass overflow-hidden flex-col shrink-0 z-40 relative border-r-0 hidden lg:flex"
      >
        {sidebarContent}
      </motion.aside>
    </>
  )
}
