import { cookies } from 'next/headers'
import { getAdminPassword } from './get-admin-password'

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Format: `${uuid}:${SHA256(uuid + ':' + ADMIN_PASSWORD)}`
// Generated on login. Every session gets a unique UUID.
export async function verificarAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const adminPassword = await getAdminPassword()

  if (!adminPassword || !session) throw new Error('Não autorizado')

  const colonIdx = session.indexOf(':')
  if (colonIdx < 1) throw new Error('Não autorizado')

  const sessionId = session.slice(0, colonIdx)
  const sig = session.slice(colonIdx + 1)
  const expected = await sha256(`${sessionId}:${adminPassword}`)

  if (!safeEqual(sig, expected)) throw new Error('Não autorizado')
}
