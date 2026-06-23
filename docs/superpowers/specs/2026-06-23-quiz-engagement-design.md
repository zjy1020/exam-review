# 刷题体验趣味化 — 设计文档

## 概览

在不改动现有答题核心逻辑的前提下，为 quiz-view 叠加一层趣味交互层，提升答题沉浸感和成就感。

## 架构原则

- **零侵入**：所有新功能都是独立组件/hooks，不修改现有答题流程
- **可开关**：每个功能都可以通过用户配置或右上角面板独立开关
- **移动端友好**：适配 Capacitor WebView，键盘提示在移动端隐藏，触摸优先

## 功能列表

### 1. 连击系统 (Streak)

**实现**：`hooks/use-streak.ts` + `components/quiz-streak.tsx`

- 答对一次连击 +1，答错归零
- 显示在答题卡片右上角：`🔥 x3`
- 连击 5/10/15/20 时数字样式升级（颜色变化 + 微放大动画）
- 专注模式下缩小为小圆点显示
- 数据存于组件状态，不持久化

### 2. 微动效反馈

**实现**：直接在 quiz-view.tsx 的现有卡片上叠加 CSS class 切换

- **答对**：卡片边框绿色高亮 → 300ms 渐隐 (`animate-correct`)
- **答错**：卡片水平微晃 200ms (`animate-wrong`)
- **选项选中**：弹性缩放 50ms (`animate-select`)
- 使用 Tailwind CSS keyframes 或 framer-motion

### 3. 进度条弹性动画

**实现**：修改现有 `<Progress>` 组件，添加 framer-motion 的 spring 过渡

- 当前使用 `h-1.5` 的 Progress 组件，添加 `transition` 和 `layout` 属性
- 答完一题弹性跳转到下一格

### 4. 背景粒子 (专注模式)

**实现**：`components/quiz-particles.tsx`

- Canvas 2D，约 30-50 个极淡粒子
- 仅专注模式 + 深色模式下显示
- 粒子缓慢浮动，不遮挡文字
- 使用 `requestAnimationFrame`，无性能影响
- 不依赖任何外部库

### 5. 随机鼓励语录

**实现**：`components/quiz-encouragement.tsx`

- 答对/答错时在卡片下方弹出一条文案，1.5s 后自动消失
- 答对库：`"漂亮！"`, `"继续保持！"`, `"太强了！"`, `"就是这个！"`, `"稳！"`
- 答错库：`"下次一定！"`, `"再想想～"`, `"别灰心！"`, `"看好你！"`, `"加油！"`
- 连击时出特殊文案：`"🔥 x5 势如破竹！"` 等
- 使用 framer-motion 的 AnimatePresence 做入场/出场动画

### 6. 音效系统

**实现**：`hooks/use-sound.ts` + 右上角音量开关

- 答对一声短促上升音，答错一声低沉短音
- 使用 Web Audio API 合成（极简 base64 编码，无外部文件）
- 右上角新增音量图标按钮，点击切换开关状态
- 默认开启，状态存 localStorage

### 7. 里程碑庆祝

**实现**：`components/quiz-celebration.tsx`

- 监听 `submittedIds.size / displayQuestions.length` 到达 25%/50%/75%/100%
- 每次触发极简撒花动画（约 20 个彩点，CSS @keyframes，1.5s 消退）
- 每科只触发一次（存 Set 防止重复触发）
- 100% 时触发更强的庆祝（配合成绩卡）

### 8. 完成成绩卡

**实现**：扩展现有的完成页面（`isFinished` 状态）

- **正确率环图**：使用 recharts 的 PieChart（已安装依赖）
- **最高连击**：显示本次会话最高连击数
- **章节强弱项**：按章节统计正确率，用迷你条形图展示
- **成就解锁**：如果有新成就，在成绩卡下方展示
- **评语文案**：按正确率分档：
  - 100%：`"满分！你是天才吗？"`
  - ≥80%：`"优秀！掌握得很好"`
  - ≥60%：`"还不错，再巩固一下"`
  - <60%：`"继续加油，多练几次"`

### 9. 成就徽章系统

**实现**：`hooks/use-achievements.ts` + `lib/achievements.ts`

- **成就列表**：
  - `first_perfect`：首次全对 → "初露锋芒"
  - `streak_10`：连击 10 → "势如破竹"
  - `streak_20`：连击 20 → "无人能挡"
  - `complete_subject`：完成一科所有题 → "学有所成"
  - `wrong_book_clear`：清空错题本 → "知错就改"
  - `fast_learner`：10 秒内答对一题 → "闪电侠"
- 成就存于 localStorage（`quiz-achievements`）
- 新成就解锁时触发庆祝弹窗

### 10. 计时模式

**实现**：`components/quiz-timer.tsx`

- 右上角新增计时开关按钮（时钟图标）
- 开启后每道题显示倒计时（默认 15s）
- 时间到自动提交当前答案（如有）或判错
- 计时数据不持久化
- 移动端同样可用

### 11. 键盘涟漪效果

**实现**：在现有键盘监听中添加涟漪动画

- 按 A/B/C/D 时对应选项按钮出现 CSS 涟漪
- 使用 `::after` 伪元素 + CSS animation

### 12. 彩蛋

**实现**：在 `quiz-streak.tsx` 中添加

- 连击 20 时触发全屏极光色闪烁 500ms
- 连击 30 时触发 emoji 雨 2s
- 仅触发一次，不重复

## 文件结构

```
components/
├── quiz-streak.tsx          # 连击显示
├── quiz-celebration.tsx     # 撒花/里程碑庆祝
├── quiz-particles.tsx       # 背景粒子
├── quiz-encouragement.tsx   # 鼓励语录
├── quiz-sound-toggle.tsx    # 音效开关
├── quiz-timer.tsx           # 计时模式
hooks/
├── use-streak.ts            # 连击逻辑
├── use-sound.ts             # 音效合成
├── use-achievements.ts      # 成就系统
lib/
├── achievements.ts          # 成就定义 + 存储
```

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `components/quiz-view.tsx` | 导入新组件，添加状态（streak, timer, sound on/off），将组件嵌入现有布局 |
| `app/page.tsx` | 无改动 |
| `app/globals.css` | 添加新 keyframes：`correct-glow`, `wrong-shake`, `select-bounce`, `ripple`, `confetti`, `aurora` |
| 新增文件 | 见上方列表 |

## 移动端注意事项

- 计时模式触摸友好
- 音效开关按钮尺寸适配触摸
- 粒子 Canvas 自动适配屏幕尺寸
- 键盘涟漪在移动端不显示
- 成就弹窗使用现有 shadcn/ui Dialog

## 性能

- 粒子 Canvas 在组件 unmount 时取消动画帧
- 音效使用短音频（<200ms），无内存泄漏
- 成就仅在解锁时读写 localStorage
- 所有动画使用 GPU 加速属性（transform, opacity）
