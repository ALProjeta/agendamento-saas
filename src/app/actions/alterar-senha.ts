'use server'

import { cookies } from 'next/headers'
import { verificarAdmin } from '@/lib/auth-admin'
import { getAdminPassword } from '@/lib/get-admin-password'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function alterarSenha(
  senhaAtual: string,
  novaSenha: string,
): Promise<{ ok: boolean; erro?: string }> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const atual = await getAdminPassword()
  if (senhaAtual !== atual) return { ok: false, erro: 'Senha atual incorreta.' }
  if (!novaSenha || novaSenha.length < 6) return { ok: false, erro: 'Nova senha deve ter ao menos 6 caracteres.' }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('configuracoes')
    .upsert({ chave: 'admin_password', valor: novaSenha }, { onConflict: 'chave' })

  if (error) return { ok: false, erro: error.message }

  // Re-emite o cookie de sessão assinado com a nova senha (mantém logado)
  const sessionId = crypto.randomUUID()
  const signature = await sha256(`${sessionId}:${novaSenha}`)
  const cookieStore = await cookies()
  cookieStore.set('admin_session', `${sessionId}:${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return { ok: true }
}
