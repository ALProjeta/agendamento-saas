'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Se a conexão falhar (Supabase pausado ou cold start), tenta mais uma vez após 500ms.
async function comRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    await new Promise(r => setTimeout(r, 500))
    return await fn()
  }
}

export type AdicionarDisponibilidadeResult =
  | { ok: true; criadas: number; datas: number }
  | { ok: false; erro: string }

export async function adicionarDisponibilidades(
  datas: string[],
  horaInicio: string,
  horaFim: string,
): Promise<AdicionarDisponibilidadeResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  if (datas.length === 0) return { ok: false, erro: 'Selecione pelo menos um dia.' }

  const ini = timeToMin(horaInicio)
  const fim = timeToMin(horaFim)
  if (fim <= ini) return { ok: false, erro: 'Horário de fim deve ser após o início.' }
  if (fim - ini < 15) return { ok: false, erro: 'Janela mínima de 15 minutos.' }

  try {
    return await comRetry(async () => {
      const supabase = createAdminSupabaseClient()
      let totalCriadas = 0
      let datasComCriacao = 0

      for (const data of datas) {
        const { data: existentes } = await supabase
          .from('disponibilidades')
          .select('id')
          .eq('data', data)
          .eq('hora_inicio', horaInicio)
          .eq('hora_fim', horaFim)

        if (existentes && existentes.length > 0) continue

        const { error } = await supabase.from('disponibilidades').insert({
          data,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
        })

        if (error) return { ok: false, erro: error.message }

        totalCriadas++
        datasComCriacao++
      }

      if (totalCriadas === 0) return { ok: false, erro: 'Essas janelas de disponibilidade já existem.' }

      revalidatePath('/admin/horarios')
      return { ok: true, criadas: totalCriadas, datas: datasComCriacao }
    })
  } catch {
    return { ok: false, erro: 'Falha na conexão com o banco após 2 tentativas. Tente novamente em instantes.' }
  }
}

export type RemoverDisponibilidadeResult =
  | { ok: true }
  | { ok: false; erro: string }

export async function removerDisponibilidade(id: string): Promise<RemoverDisponibilidadeResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  try {
    return await comRetry(async () => {
      const supabase = createAdminSupabaseClient()
      const { error } = await supabase.from('disponibilidades').delete().eq('id', id)
      if (error) return { ok: false, erro: error.message }

      revalidatePath('/admin/horarios')
      return { ok: true }
    })
  } catch {
    return { ok: false, erro: 'Falha na conexão com o banco após 2 tentativas. Tente novamente em instantes.' }
  }
}

export async function removerDisponibilidadesDias(datas: string[]): Promise<RemoverDisponibilidadeResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }
  if (datas.length === 0) return { ok: false, erro: 'Selecione pelo menos um dia.' }

  try {
    return await comRetry(async () => {
      const supabase = createAdminSupabaseClient()
      const { error } = await supabase.from('disponibilidades').delete().in('data', datas)
      if (error) return { ok: false, erro: error.message }

      revalidatePath('/admin/horarios')
      return { ok: true }
    })
  } catch {
    return { ok: false, erro: 'Falha na conexão com o banco após 2 tentativas. Tente novamente em instantes.' }
  }
}
