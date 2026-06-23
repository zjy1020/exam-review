# 期末复习 — 刷题工具

一个功能丰富的刷题 Web 应用，支持多科目管理、多种题型、AI 辅助导入、趣味答题互动。

## 功能一览

### 科目管理
- 创建/删除/重命名科目，每个科目独立题库
- 侧边栏快捷键展开收起
- 数据导入导出（JSON 备份/恢复）
- 一键导入（受密码保护的默认题库）

### 题目导入
- 粘贴文本或拖入 .md/.docx/.txt 文件
- 自动识别章节（`=== 第X章 ===`）和题号，支持 Word 格式
- 支持选择题、判断题、填空题、多选题、简答题
- AI 格式化（一键复制提示到 DeepSeek/豆包，粘贴返回结果即可）
- AI 补全缺失答案和解析
- 题库导入/导出为标准化 JSON

### 答题模式
- **顺序答题** / **打乱顺序**
- **选项打乱** — 选项顺序随机（不影响原始答案引用）
- **按章节筛选** — 单选/多选章节，针对性练习
- **按题型筛选** — 主攻选择/判断/填空/简答
- **专注模式** — 隐藏侧边栏和导航栏，沉浸式刷题
- **背题模式** — 显示所有题目及解析，快速浏览记忆
- **答题大纲** — 按章节和题型分组，点击跳转至任意题目
- **错题本** — 自动记录错题，支持单题移出/清空
- **键盘快捷键** — `A` `B` `C` `D` 选择，`Enter` 确认/下一题
- **进度条** — 实时显示答题进度

### 趣味互动层
- **连击系统** — 连续答对叠加连击，断连自动重置
- **鼓励语录** — 根据连击区间显示不同风格的励志文案（会逐渐变短变狂）
- **音效反馈** — Web Audio API 合成音效（正确音/错误音），可开关
- **答题计时** — 15 秒倒计时，时间到自动提交并进入下一题
- **粒子背景** — 专注模式下显示动态粒子效果
- **成就系统** — 6 个成就（首次答题、全对章节、连击达人、错题清空、快手、百题斩），持久化存储
- **庆祝动画** — 撒花特效 + 里程碑弹窗（25%/50%/75%/100% 进度）
- **成绩卡** — 完成答题后展示正确率环图、连击统计、章节正确率、成就解锁情况、评语文案

### 界面主题
- 深色/浅色主题切换，支持 CSS 变量
- 毛玻璃导航栏
- 全屏渐变封面页
- 响应式布局（桌面/平板/手机）

### 数据持久化
- 基于 localStorage，刷新不丢失
- 单科目数据独立存储
- 支持全量备份与恢复

## 技术栈

| 层面 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 严格模式 |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| 图表 | Recharts（环形图） |
| 文档解析 | Mammoth（Word 转文本） |
| 移动端 | Capacitor（可选，构建 Android APK） |

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 主页面（科目切换、视图管理）
│   ├── globals.css           # 全局样式 & Tailwind
│   └── layout.tsx            # 根布局
├── components/
│   ├── ui/                   # shadcn/ui 基础组件
│   ├── quiz-view.tsx         # 答题主引擎（核心逻辑 ~1700 行）
│   ├── quiz-streak.tsx       # 连击徽章
│   ├── quiz-encouragement.tsx # 鼓励语录
│   ├── quiz-particles.tsx    # Canvas 粒子背景
│   ├── quiz-sound-toggle.tsx # 音效开关
│   ├── quiz-timer.tsx        # 答题倒计时
│   ├── quiz-celebration.tsx  # 撒花庆祝动画
│   ├── import-panel.tsx      # 导入面板
│   ├── sidebar.tsx           # 科目侧边栏
│   └── cover-page.tsx        # 封面页
├── hooks/
│   ├── use-streak.ts         # 连击追踪
│   ├── use-sound.ts          # Web Audio 音效
│   └── use-achievements.ts   # 成就系统
├── lib/
│   ├── parse-questions.ts    # 题目解析器
│   ├── storage.ts            # localStorage 读写
│   ├── types.ts              # 类型定义
│   ├── achievements.ts       # 成就定义
│   └── utils.ts              # 工具函数
```

## 开始使用

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

## 构建

```bash
pnpm build           # 生产构建
pnpm start           # 启动生产服务
```

### 移动端 APK 构建

```bash
npm install -g @capacitor/cli
npx cap init
npx cap add android
npx cap sync
cd android && ./gradlew assembleDebug
```

## 使用流程

1. 左侧新建科目（如"高等数学"）
2. 粘贴或拖入题目文本，点击"导入题目"
3. 如有格式问题，可用 AI 格式化后再导入
4. 点击"开始答题"进入答题模式
5. 答题过程中自动记录错题、连击、成就
6. 可使用筛选面板选择特定章节/题型重点练习
7. 完成答题后查看成绩卡和成就

## 题目格式

支持以下格式自动解析：

```
=== 第1章 ===

[1]
题目：xxxx
A. xxx
B. xxx
C. xxx
D. xxx
答案：A
解释：xxx

[2]
题目：xxxx
答案：对

[3]
题目：xxxx
答案：xxx
```

也支持无题号、无章节的纯题目列表。导入后可使用"AI 格式化"功能自动整理不规范格式。

## 设计思路

- **零侵入架构** — 趣味互动层（hooks + 独立组件）不修改现有答题核心逻辑
- **渐进式发现** — 所有趣味功能默认关闭或有意识触发，不影响纯粹刷题体验
- **本地优先** — 数据全在 localStorage，无需后端，即开即用
