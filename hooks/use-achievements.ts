"use client"

import { useState, useCallback } from "react"
import { ACHIEVEMENTS, loadUnlocked, saveUnlocked, type AchievementStats } from "@/lib/achievements"

export function useAchievements() {
  const [unlocked, setUnlocked] = useState<string[]>(loadUnlocked)
  const [newUnlocks, setNewUnlocks] = useState<string[]>([])

  const checkAchievements = useCallback((stats: AchievementStats) => {
    const newOnes = ACHIEVEMENTS
      .filter((a) => !unlocked.includes(a.id) && a.condition(stats))
      .map((a) => a.id)

    if (newOnes.length > 0) {
      const updated = [...unlocked, ...newOnes]
      setUnlocked(updated)
      saveUnlocked(updated)
      setNewUnlocks(newOnes)
    }
  }, [unlocked])

  const clearNewUnlocks = useCallback(() => setNewUnlocks([]), [])

  const unlockedDetails = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id))
  const lockedDetails = ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id))

  return { unlocked, newUnlocks, unlockedDetails, lockedDetails, checkAchievements, clearNewUnlocks }
}
