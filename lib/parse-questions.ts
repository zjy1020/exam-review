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
    // Strip markdown code block markers that AI models often add
    .filter((l) => !l.startsWith('```'))

  // Fix mangled options caused by AI copy-paste corruption of $ @ % etc.
  for (let i = 0; i < lines.length; i++) {
    // Pattern: "B." alone on line, content on next line → "B. $"
    if (/^[A-Da-d]\.$/.test(lines[i]) && i + 1 < lines.length && lines[i + 1].length < 5) {
      lines[i] = `${lines[i]} ${lines[i + 1]}`
      lines.splice(i + 1, 1)
      continue
    }
    // Pattern: "C", ".", "@" on separate lines → "C. @"
    if (i >= 2 && /^[A-Da-d]$/.test(lines[i - 2]) && /^[.、）)\s．]$/.test(lines[i - 1]) && lines[i].length < 5) {
      lines[i - 2] = `${lines[i - 2]}. ${lines[i]}`
      lines.splice(i - 1, 2)
      i -= 2
      continue
    }
  }

  const questions: Question[] = []
  let current: Partial<Question> & { options: string[] } | null = null
  let questionNumber = 0
  let inOptions = false
  let inExplanation = false
  let inAnswer = false
  let pendingType: Question['type'] | undefined
  let currentChapter = ''

  const flush = () => {
    if (current && current.question) {
      // Auto-detect multi-choice: answer contains 2+ distinct letters (A-D)
      if (!current.type && current.options.length > 0 && current.answer) {
        const ansClean = current.answer.replace(/[.。\s]/g, '').toUpperCase()
        const letters = ansClean.replace(/[^A-D]/g, '')
        if (letters.length >= 2) {
          current.type = 'multiple'
        }
      }
      // If answer is a letter like "A", resolve it
      let answer = current.answer || ''
      const answerLetter = answer.replace(/[.。\s]/g, '').toUpperCase()
      if (
        /^[A-D]$/.test(answerLetter) &&
        current.options.length > 0
      ) {
        const matched = current.options.find((o) =>
          o.toUpperCase().startsWith(answerLetter + '.') || o.toUpperCase().startsWith(answerLetter + '、') || o.toUpperCase().startsWith(answerLetter + '）') || o.toUpperCase().startsWith(answerLetter + '．')
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
        ...(current.type ? { type: current.type } : {}),
      })
    }
    current = null
    inOptions = false
    inExplanation = false
    inAnswer = false
  }

  for (const line of lines) {
    // Detect chapter/section markers
    const chapterMatch = line.match(/^={2,}\s*(第\s*[一二三四五六七八九十\d]+\s*[章节部篇]).*={2,}\s*$|^#+\s*(第\s*[一二三四五六七八九十\d]+\s*[章节部篇])|^(第\s*[一二三四五六七八九十\d]+\s*[章节部篇])/)
    if (chapterMatch) {
      flush()
      currentChapter = (chapterMatch[1] || chapterMatch[2] || chapterMatch[3]).replace(/\s+/g, '').trim()
      continue
    }

    // Detect "题型：" label — set type for the current/pending question
    const typeMatch = line.match(/^题型[：:]\s*(.+)/)
    if (typeMatch) {
      const t = typeMatch[1].trim()
      if (t.includes('多选')) pendingType = 'multiple'
      else if (t.includes('选择')) pendingType = 'choice'
      else if (t.includes('判断')) pendingType = 'truefalse'
      else if (t.includes('填空')) pendingType = 'input'
      else if (t.includes('简答')) pendingType = 'essay'
      else pendingType = undefined
      if (current) current.type = pendingType
      continue
    }

    // Detect question number patterns: "1.", "1．", "1）", "[1]", "第1题", "[题号] 1"
    const numMatch = line.match(/^(?:\[?(\d+)\]?[.、）)\s．]|第(\d+)题[.、：:\s]?)/)
    const aiNumMatch = line.match(/^\[(\d+)\]/)
    const tiHaoMatch = line.match(/^\[题号\]\s*(\d+)/)
    const hasNumber = numMatch || aiNumMatch || tiHaoMatch

    if (hasNumber) {
      flush()
      questionNumber = parseInt(hasNumber[1] || hasNumber[2])
      current = { options: [], number: questionNumber }
      if (pendingType) { current.type = pendingType; pendingType = undefined }
      // Extract question text after the number prefix
      const rest = line.replace(/^(?:\[?\d+\]?[.、）)\s．]|第\d+题[.、：:\s]?|\[\d+\]|\[题号\]\s*\d+)/, '').trim()
      // Remove "题目：" prefix if present
      const qText = rest.replace(/^题目[：:]\s*/, '').trim()
      if (qText) {
        current.question = qText
      }
      inOptions = false
      inExplanation = false
      inAnswer = false
      continue
    }

    // Dash-prefixed lines (from markdown converters that turn numbered lists into "- "):
    const dashMatch = line.match(/^-\s+(.+)/)
    if (dashMatch && !/^-[A-Da-d]/i.test(line)) {
      flush()
      questionNumber++
      current = { options: [], number: questionNumber }
      if (pendingType) { current.type = pendingType; pendingType = undefined }
      current.question = dashMatch[1].trim()
      inOptions = false
      inExplanation = false
      inAnswer = false
      continue
    }

    // "题目：" prefix (in AI cleaned format) — always starts a new question
    const titleMatch = line.match(/^题目[：:]\s*(.+)/)
    if (titleMatch) {
      const hadNumber = current?.number != null
      flush()
      if (!hadNumber) questionNumber++
      current = { options: [], number: questionNumber }
      if (pendingType) { current.type = pendingType; pendingType = undefined }
      current.question = titleMatch[1].trim()
      inOptions = false
      inExplanation = false
      inAnswer = false
      continue
    }

    // Options: A. / B. / C. / D. or A、 B、 C、 D、 or A．B．C．D．
    const optMatch = line.match(/^([A-Da-d])[.、）)\s．]\s*(.+)/)
    if (optMatch && current) {
      current.options.push(line)
      inOptions = true
      inExplanation = false
      inAnswer = false
      continue
    }

    // "答案：" or "正确答案："
    const ansMatch = line.match(/^(?:正确)?答案[：:]\s*(.+)/)
    if (ansMatch && current) {
      current.answer = ansMatch[1].trim()
      inOptions = false
      inExplanation = false
      inAnswer = false
      continue
    }
    // "答案：" on its own line (empty content — followed by code block)
    const ansEmptyMatch = line.match(/^(?:正确)?答案[：:]\s*$/)
    if (ansEmptyMatch && current) {
      current.answer = ''
      inOptions = false
      inExplanation = false
      inAnswer = true
      continue
    }

    // "解释：" or "解析："
    const expMatch = line.match(/^(?:解释|解析)[：:]\s*(.+)/)
    if (expMatch && current) {
      current.explanation = expMatch[1].trim()
      inOptions = false
      inExplanation = true
      inAnswer = false
      continue
    }

    // Continuation lines: unrecognized lines append to question text
    if (current) {
      if (inOptions && current.options.length > 0) {
        current.options[current.options.length - 1] += ' ' + line
      } else if (inAnswer) {
        current.answer = (current.answer || '') + '\n' + line
      } else if (inExplanation) {
        current.explanation = (current.explanation || '') + ' ' + line
      } else {
        current.question = (current.question || '') + ' ' + line
      }
    }
  }

  flush()

  // If AI omitted the first chapter marker (e.g. starts with === 第2章 ===),
  // retroactively assign pre-chapter questions to the inferred first chapter
  const firstChapterIdx = questions.findIndex(q => q.chapter)
  if (firstChapterIdx > 0 && questions.slice(0, firstChapterIdx).every(q => !q.chapter)) {
    const firstChapterName = questions[firstChapterIdx].chapter!
    // Infer previous chapter: "第2章" → "第1章", "第二章" → "第一章"
    const inferred = firstChapterName.replace(
      /(第)(\d+|[一二三四五六七八九十]+)([章节部篇])/,
      (_m, prefix, num, suffix) => {
        if (/^\d+$/.test(num)) return `${prefix}${String(parseInt(num) - 1)}${suffix}`
        // Chinese numeral → always "一" since it's the first chapter
        return `${prefix}一${suffix}`
      }
    )
    for (let i = 0; i < firstChapterIdx; i++) {
      questions[i].chapter = inferred
    }
  }

  return questions
}

export function buildFormatPrompt(text: string): string {
  return `你是一个答题整理助手。请把以下题目整理成统一格式，并给出正确答案和详细解析。
要求：
- 【重要】纯文本输出，不要使用任何 markdown 格式（不要代码块、不要反引号）
- 【重要】选项中的 $ @ % # 等符号直接保留原样，不要加反引号或转义，每个选项必须在同一行（如 B. $ 不要拆成 B. 和 $）
- 阅读全文，确认是否有"第一章"、"第二章"、"第1节"等明确的章节标记
- 只有当原文明确包含章节标记时，才按章节分组，用 "=== 第X章 ===" 作为分隔
- 【重要】第一道题前面也要加上章节标记，不要省略第一章的标记
- 如果原文没有任何章节标记，绝对不要添加任何章节标题，直接输出题目列表
- 原文中每道题可能以 "- "（短横+空格）开头而不是数字，这种情况下请按顺序依次编号为 1, 2, 3...
- 【关键】自动判断每道题的题型，在题号后面加题型标注

  单选题格式（只有一个正确答案）：
  [题号]
  题型：选择题
  题目：xxx
  A. xxx
  B. xxx
  C. xxx
  D. xxx
  答案：X
  解释：xxx

  多选题格式（有多个正确答案，答案写字母如ABCD或ABD）：
  [题号]
  题型：多选题
  题目：xxx
  A. xxx
  B. xxx
  C. xxx
  D. xxx
  答案：ABCD
  解释：xxx

  判断题格式（选项固定为"A. 对"和"B. 错"）：
  [题号]
  题型：判断题
  题目：xxx
  A. 对
  B. 错
  答案：A
  解释：xxx

  填空题格式（答案是短词/短句）：
  [题号]
  题型：填空题
  题目：xxx
  答案：xxx
  解释：xxx

  简答题格式（答案是长文本/代码/多行）：
  [题号]
  题型：简答题
  题目：xxx
  答案：xxx
  解释：xxx

- 如果原题没有答案和解释，请根据知识推断出正确答案并给出详细解析
- 解析必须详细、通俗易懂，说明为什么选这个答案、其他选项为什么错、相关知识点
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
- 解析必须详细、通俗易懂，说明为什么选这个答案、其他选项为什么错、相关知识点，用日常语言解释清楚，让初学者也能看懂
- 不要额外文字

题目内容：
${qText}`
}
