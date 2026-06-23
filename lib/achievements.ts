export interface Achievement {
  id: string
  name: string
  icon: string
  condition: (stats: AchievementStats) => boolean
}

export interface AchievementStats {
  totalCorrect: number
  maxStreak: number
  subjectCompleted: boolean
  wrongBookCleared: boolean
  fastAnswerCount: number
  totalAnswered: number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_perfect", name: "初露锋芒", icon: "⭐", condition: (s) => s.totalCorrect >= 10 },
  { id: "streak_10", name: "势如破竹", icon: "🔥", condition: (s) => s.maxStreak >= 10 },
  { id: "streak_20", name: "无人能挡", icon: "💥", condition: (s) => s.maxStreak >= 20 },
  { id: "complete_subject", name: "学有所成", icon: "🎓", condition: (s) => s.subjectCompleted },
  { id: "wrong_book_clear", name: "知错就改", icon: "📖", condition: (s) => s.wrongBookCleared },
  { id: "fast_learner", name: "闪电侠", icon: "⚡", condition: (s) => s.fastAnswerCount >= 3 },
]

export function loadUnlocked(): string[] {
  try {
    const raw = localStorage.getItem("quiz-achievements")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveUnlocked(ids: string[]) {
  try { localStorage.setItem("quiz-achievements", JSON.stringify(ids)) }
  catch { /* ignore */ }
}
