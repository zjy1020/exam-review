import type { Question } from './types'

/**
 * Parse formatted question text into Question objects.
 * Handles multiple formats:
 *
 * 1. Numbered with A/B/C/D options:
 *    1. 中国的首都是？
 *    A. 北京
 *    B. 上海
 *    C. 广州
 *    D. 深圳
 *    答案：A
 *    解释：北京是中国的首都...
 *
 * 2. AI cleaned format:
 *    [1]
 *    题目：中国的首都是？
 *    A. 北京
 *    B. 上海
 *    C. 广州
 *    D. 深圳
 *    答案：A
 *    解释：北京是中国的首都...
 */
export function parseQuestions(text: string): Question[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const questions: Question[] = []
  let current: Partial<Question> & { options: string[] } | null = null
  let questionNumber = 0
  let inOptions = false
  let inExplanation = false
  let currentChapter = ''

  const flush = () => {
    if (current && current.question) {
      // If answer is a letter like "A", resolve it
      let answer = current.answer || ''
      const answerLetter = answer.replace(/[.。\s]/g, '').toUpperCase()
      if (
        /^[A-D]$/.test(answerLetter) &&
        current.options.length > 0
      ) {
        const matched = current.options.find((o) =>
          o.toUpperCase().startsWith(answerLetter + '.') || o.toUpperCase().startsWith(answerLetter + '、') || o.toUpperCase().startsWith(answerLetter + '）')
        )
        if (matched) {
          answer = matched
        }
      }
      questions.push({
        id: `q-${questionNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number: questionNumber,
        question: current.question,
        options: current.options,
        answer,
        explanation: current.explanation || '',
        ...(currentChapter ? { chapter: currentChapter } : {}),
      })
    }
    current = null
    inOptions = false
    inExplanation = false
  }

  for (const line of lines) {
    // Detect chapter/section markers: "=== 第X章 ===", "第X章", "第一章" etc.
    const chapterMatch = line.match(/^={2,}\s*(第\s*[一二三四五六七八九十\d]+\s*[章节部篇])\s*={2,}$|^(第\s*[一二三四五六七八九十\d]+\s*[章节部篇])/)
    if (chapterMatch) {
      flush() // flush previous chapter's last question before switching chapter
      currentChapter = (chapterMatch[1] || chapterMatch[2]).replace(/\s+/g, '').trim()
      continue
    }

    // Detect question number patterns: "1.", "1）", "[1]", "第1题"
    const numMatch = line.match(/^(?:\[?(\d+)\]?[.、）)\s]|第(\d+)题[.、：:\s]?)/)
    const aiNumMatch = line.match(/^\[(\d+)\]/)
    const hasNumber = numMatch || aiNumMatch

    if (hasNumber) {
      flush()
      questionNumber = parseInt(hasNumber[1] || hasNumber[2])
      current = { options: [], number: questionNumber }
      // Extract question text after the number prefix
      const rest = line.replace(/^(?:\[?\d+\]?[.、）)\s]|第\d+题[.、：:\s]?|\[\d+\])/, '').trim()
      // Remove "题目：" prefix if present
      const qText = rest.replace(/^题目[：:]\s*/, '').trim()
      if (qText) {
        current.question = qText
      }
      inOptions = false
      inExplanation = false
      continue
    }

    // "题目：" prefix (in AI cleaned format)
    const titleMatch = line.match(/^题目[：:]\s*(.+)/)
    if (titleMatch && current) {
      current.question = titleMatch[1].trim()
      inOptions = false
      inExplanation = false
      continue
    }

    // Options: A. / B. / C. / D. or A、 B、 C、 D、
    const optMatch = line.match(/^([A-Da-d])[.、）)\s]\s*(.+)/)
    if (optMatch && current) {
      current.options.push(line)
      inOptions = true
      inExplanation = false
      continue
    }

    // "答案：" or "正确答案："
    const ansMatch = line.match(/^(?:正确)?答案[：:]\s*(.+)/)
    if (ansMatch && current) {
      current.answer = ansMatch[1].trim()
      inOptions = false
      inExplanation = false
      continue
    }

    // "解释：" or "解析："
    const expMatch = line.match(/^(?:解释|解析)[：:]\s*(.+)/)
    if (expMatch && current) {
      current.explanation = expMatch[1].trim()
      inOptions = false
      inExplanation = true
      continue
    }

    // Continuation lines: if we're in options or explanation, append
    if (current) {
      if (inOptions && current.options.length > 0) {
        current.options[current.options.length - 1] += ' ' + line
      } else if (inExplanation) {
        current.explanation = (current.explanation || '') + ' ' + line
      } else if (!current.question) {
        current.question = line
      }
    }
  }

  flush()
  return questions
}

export function buildFormatPrompt(text: string): string {
  return `你是一个答题整理助手。请把以下题目整理成统一格式，并给出正确答案和详细解释。
要求：
- 如果内容有章节划分（如"第一章"、"第二章"或"第1节"、"第2节"等），请按章节分组，每章前用 "=== 第X章 ===" 作为分隔
- 保留题号和选项（A. B. C. D.）
- 每道题格式：
  === 第X章 ===
  [题号]
  题目：xxx
  A. xxx
  B. xxx
  C. xxx
  D. xxx
  答案：X
  解释：xxx
- 如果没有章节，直接输出题目列表，不加分隔
- 如果原题没有答案和解释，请根据知识推断出正确答案并给出解释
- 不要额外文字

题目内容：
${text}`
}

export function buildFillPrompt(questions: Question[]): string {
  const qText = questions
    .map(
      (q) =>
        `[${q.number}]\n题目：${q.question}\n${
          q.options.length > 0 ? q.options.join('\n') + '\n' : ''
        }${q.answer ? '答案：' + q.answer : '答案：'}\n${q.explanation ? '解释：' + q.explanation : '解释：'}`
    )
    .join('\n\n')

  return `你是一个答题助手。以下题目中有一部分缺少答案或解析，请根据知识补全。
要求：
- 保留原题号、题目和选项不变
- 补全缺失的答案和解析
- 每道题格式：
  [题号]
  题目：xxx
  A. xxx
  B. xxx
  C. xxx
  D. xxx
  答案：X
  解释：xxx
- 不要额外文字

题目内容：
${qText}`
}
