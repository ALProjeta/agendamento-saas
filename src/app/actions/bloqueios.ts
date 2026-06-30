'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export type Conflito = {
  id: string
  cliente_nome: string
  data: string
  hora_inicio: string
}

export type VerificarResult = { conflitos: Conflito[] }

export async function verificarConflitos(
  dataInicio: string,
  dataFim: string,
): Promise<VerificarResult> {
  try { await verificarAdmin() } catch { return { conflitos: [] } }

  const supabase = createAdminSupabaseClient()

  const { data: ags } = await supabase
    .from('agendamentos')
    .select('id, cliente_nome, data, hora_inicio')
    .eq('status', 'confirmado')
    .gte('data', dataInicio)
    .lte('data', dataFim)

  const conflitos: Conflito[] = (ags ?? []).map(a => ({
    id: a.id,
    cliente_nome: a.cliente_nome as string,
    data: a.data as string,
    hora_inicio: a.hora_inicio as string,
  }))

  conflitos.sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
  return { conflitos }
}

export type BloqueioResult = { ok: true } | { ok: false; erro: string }

export async function criarBloqueio(
  dataInicio: string,
  dataFim: string,
  motivo?: string,
  // IDs de agendamentos a cancelar antes de criar o bloqueio
  cancelarIds?: string[],
): Promise<BloqueioResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()

  // Cancela os agendamentos conflitantes
  if (cancelarIds && cancelarIds.length > 0) {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .in('id', cancelarIds)
    if (error) return { ok: false, erro: 'Erro ao cancelar agendamentos conflitantes: ' + error.message }
  }

  const { error } = await supabase
    .from('bloqueios')
    .insert({ data_inicio: dataInicio, data_fim: dataFim, motivo: motivo?.trim() || null })
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/admin/bloqueios')
  revalidatePath('/admin/agenda')
  return { ok: true }
}

export async function removerBloqueio(id: string): Promise<BloqueioResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('bloqueios').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/bloqueios')
  return { ok: true }
}
