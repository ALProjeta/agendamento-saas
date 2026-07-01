'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export type EncaixeCheck =
  | { status: 'livre' }
  | { status: 'sem-disponibilidade' }
  | { status: 'conflito'; conflitoCom: string }

export async function verificarEncaixe(
  data: string,
  horaInicio: string,
  horaFim: string,
): Promise<EncaixeCheck> {
  try { await verificarAdmin() } catch { return { status: 'sem-disponibilidade' } }

  const supabase = createAdminSupabaseClient()

  const [{ data: disps }, { data: conflitos }] = await Promise.all([
    supabase
      .from('disponibilidades')
      .select('id')
      .eq('data', data)
      .lte('hora_inicio', horaInicio)
      .gte('hora_fim', horaFim)
      .limit(1),
    supabase
      .from('agendamentos')
      .select('cliente_nome')
      .eq('data', data)
      .neq('status', 'cancelado')
      .lt('hora_inicio', horaFim)
      .gt('hora_fim', horaInicio)
      .limit(1),
  ])

  if (conflitos && conflitos.length > 0) {
    return { status: 'conflito', conflitoCom: (conflitos[0] as { cliente_nome: string }).cliente_nome }
  }
  if (!disps || disps.length === 0) {
    return { status: 'sem-disponibilidade' }
  }
  return { status: 'livre' }
}

export async function agendarManual(
  nome: string,
  telefone: string,
  servicoId: string,
  data: string,
  horaInicio: string,
  horaFim: string,
  observacao?: string,
): Promise<{ ok: boolean; erro?: string }> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  if (!nome.trim() || !telefone.trim() || !servicoId || !data || !horaInicio || !horaFim) {
    return { ok: false, erro: 'Preencha todos os campos obrigatórios.' }
  }

  const supabase = createAdminSupabaseClient()

  const { error } = await supabase.from('agendamentos').insert({
    cliente_nome:     nome.trim(),
    cliente_telefone: telefone.trim(),
    servico_id:       servicoId,
    data,
    hora_inicio:      horaInicio,
    hora_fim:         horaFim,
    status:           'confirmado',
    observacao:       observacao?.trim() || null,
  })

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/admin/agenda')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}
