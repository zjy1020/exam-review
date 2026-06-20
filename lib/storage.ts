import type { Question, Subject, SubjectData } from './types'

const SUBJECTS_KEY = 'quiz-subjects'
const ACTIVE_KEY = 'quiz-active-subject'

function getDataKey(id: string) {
  return `quiz-subject-data-${id}`
}

export function saveSubjects(subjects: Subject[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects))
}

export function loadSubjects(): Subject[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveActiveSubject(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, id)
}

export function loadActiveSubject(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveSubjectData(id: string, data: SubjectData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getDataKey(id), JSON.stringify(data))
}

export function loadSubjectData(id: string): SubjectData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getDataKey(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function deleteSubject(id: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getDataKey(id))
}

export function renameSubject(id: string, newName: string) {
  if (typeof window === 'undefined') return
  const subjects = loadSubjects()
  const updated = subjects.map((s) => (s.id === id ? { ...s, name: newName } : s))
  saveSubjects(updated)
}
