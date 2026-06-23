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
