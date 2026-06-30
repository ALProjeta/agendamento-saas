'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function getConfigPublica(): Promise<Record<string, string>> {
  try {
    const supabase = createAdminSupabaseClient()
    const { data } = await supabase.from('configuracoes').select('chave, valor')
    const cfg: Record<string, string> = {}
    for (const row of (data ?? [])) cfg[row.chave] = row.valor
    return cfg
  } catch {
    return {}
  }
}

export async function salvarConfig(
  entries: Record<string, string>,
): Promise<{ ok: boolean; erro?: string }> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const rows = Object.entries(entries).map(([chave, valor]) => ({ chave, valor }))

  const { error } = await supabase
    .from('configuracoes')
    .upsert(rows, { onConflict: 'chave' })

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/admin/configuracoes')
  revalidatePath('/', 'layout')
  return { ok: true }
}
