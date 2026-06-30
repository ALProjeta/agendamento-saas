import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import { getStudioNome } from '@/lib/config'
import './globals.css'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export async function generateMetadata(): Promise<Metadata> {
  const nome = await getStudioNome()
  return {
    title: `${nome} — Agendamento`,
    description: 'Agende seu horário de forma rápida e fácil',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: nome,
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0A0A0A]">{children}</body>
    </html>
  )
}
