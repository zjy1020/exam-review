export interface Question {
  id: string
  number: number
  question: string
  options: string[]
  answer: string
  explanation: string
  chapter?: string
}

export interface Subject {
  id: string
  name: string
  createdAt: number
}

export interface SubjectData {
  questions: Question[]
  wrongIds: string[]
}
