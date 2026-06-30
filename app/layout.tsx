import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Playfair_Display } from 'next/font/google'
import { GeistPixelGrid } from 'geist/font/pixel'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: '期末复习 | zjy520',
  description: '期末复习刷题工具 — 导入题目，开始刷题，错题本巩固。',
  keywords: [
    '期末复习',
    '刷题工具',
    '在线答题',
    '错题本',
    '教育工具',
    '复习系统',
  ],
  authors: [{ name: 'zjy520', url: 'https://github.com/zjy1020' }],
  creator: 'zjy520',
  publisher: 'zjy520',
}

export const viewport: Viewport = {
  themeColor: '#F2F1EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${jetbrainsMono.variable} ${playfairDisplay.variable} ${GeistPixelGrid.variable} dark`} suppressHydrationWarning>
      <body className="font-mono antialiased">
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('quiz-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})();`
        }} />
        {children}
      </body>
    </html>
  )
}
