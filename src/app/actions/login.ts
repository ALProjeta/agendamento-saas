'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { getAdminPassword } from '@/lib/get-admin-password'

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

type LoginState = { erro: string | null }

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  const limit = await checkRateLimit(`login:${ip}`)
  if (!limit.ok) {
    const min = limit.minutosRestantes ?? 15
    return { erro: `Muitas tentativas. Tente novamente em ${min} minuto${min === 1 ? '' : 's'}.` }
  }

  const senha = (formData.get('senha') as string | null)?.trim() ?? ''
  const adminPassword = await getAdminPassword()

  if (!adminPassword || senha !== adminPassword) {
    return { erro: 'Senha incorreta. Tente novamente.' }
  }

  await resetRateLimit(`login:${ip}`)

  // Unique token per session: UUID + HMAC-like signature
  const sessionId = crypto.randomUUID()
  const signature = await sha256(`${sessionId}:${adminPassword}`)
  const sessionValue = `${sessionId}:${signature}`

  const cookieStore = await cookies()
  cookieStore.set('admin_session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  redirect('/admin/agenda')
}
