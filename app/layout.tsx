import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { GeistPixelGrid } from 'geist/font/pixel'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: '期末复习 | 继业大大',
  description: '期末复习刷题工具 — 导入题目，开始刷题，错题本巩固。',
  keywords: [
    '期末复习',
    '刷题工具',
    '在线答题',
    '错题本',
    '教育工具',
    '复习系统',
  ],
  authors: [{ name: '继业大大', url: 'https://github.com/likeLBY' }],
  creator: '继业大大',
  publisher: '继业大大',
}

export const viewport: Viewport = {
  themeColor: '#F2F1EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${jetbrainsMono.variable} ${GeistPixelGrid.variable}`} suppressHydrationWarning>
      <body className="font-mono antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
