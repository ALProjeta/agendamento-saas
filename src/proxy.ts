import { NextRequest, NextResponse } from 'next/server'

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

function invalidate(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/admin', request.url))
  res.cookies.delete('admin_session')
  return res
}

export async function proxy(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return NextResponse.redirect(new URL('/admin', request.url))

  const session = request.cookies.get('admin_session')?.value
  if (!session) return NextResponse.redirect(new URL('/admin', request.url))

  const colonIdx = session.indexOf(':')
  if (colonIdx < 1) return invalidate(request)

  const sessionId = session.slice(0, colonIdx)
  const sig = session.slice(colonIdx + 1)
  const expected = await sha256(`${sessionId}:${adminPassword}`)

  if (!safeEqual(sig, expected)) return invalidate(request)

  return NextResponse.next()
}

// Protege /admin/... — a própria página /admin (login) fica livre
export const config = {
  matcher: ['/admin/:path+'],
}
