'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function atualizarStatus(
  id: string,
  status: 'concluido' | 'cancelado',
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await verificarAdmin()
  } catch {
    return { ok: false, erro: 'Não autorizado.' }
  }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('agendamentos').update({ status }).eq('id', id)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/admin/agenda')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}
