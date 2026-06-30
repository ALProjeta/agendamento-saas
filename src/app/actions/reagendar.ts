'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export async function getHorariosDisponiveis(
  dateStr: string,
  duracaoMinutos: number,
): Promise<{ hora_inicio: string; hora_fim: string }[]> {
  try { await verificarAdmin() } catch { return [] }

  const supabase = createAdminSupabaseClient()

  const [{ data: disps }, { data: ags }] = await Promise.all([
    supabase.from('disponibilidades').select('hora_inicio, hora_fim').eq('data', dateStr).order('hora_inicio'),
    supabase.from('agendamentos').select('hora_inicio, hora_fim').eq('data', dateStr).neq('status', 'cancelado'),
  ])

  const agendados = (ags ?? []).map(a => ({
    ini: timeToMin(a.hora_inicio),
    fim: timeToMin(a.hora_fim),
  }))

  const horarios: { hora_inicio: string; hora_fim: string }[] = []
  const vistos = new Set<string>()
  const STEP = 15

  for (const disp of (disps ?? [])) {
    const winIni = timeToMin(disp.hora_inicio)
    const winFim = timeToMin(disp.hora_fim)
    for (let t = winIni; t + duracaoMinutos <= winFim; t += STEP) {
      const timeStr = minToTime(t)
      if (vistos.has(timeStr)) continue
      const tFim = t + duracaoMinutos
      const conflito = agendados.some(ag => t < ag.fim && tFim > ag.ini)
      if (!conflito) {
        horarios.push({ hora_inicio: timeStr, hora_fim: minToTime(tFim) })
        vistos.add(timeStr)
      }
    }
  }

  return horarios
}

export async function reagendar(
  agendamentoId: string,
  novaData: string,
  novaHoraInicio: string,
  novaHoraFim: string,
): Promise<{ ok: boolean; erro?: string }> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status')
    .eq('id', agendamentoId)
    .single()

  if (!ag || ag.status !== 'confirmado') {
    return { ok: false, erro: 'Agendamento não encontrado ou não está confirmado.' }
  }

  const { data: conflitos } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('data', novaData)
    .neq('status', 'cancelado')
    .neq('id', agendamentoId)
    .lt('hora_inicio', novaHoraFim)
    .gt('hora_fim', novaHoraInicio)
    .limit(1)

  if (conflitos && conflitos.length > 0) {
    return { ok: false, erro: 'Este horário já foi reservado por outro cliente.' }
  }

  const { error } = await supabase
    .from('agendamentos')
    .update({ data: novaData, hora_inicio: novaHoraInicio, hora_fim: novaHoraFim })
    .eq('id', agendamentoId)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/admin/agenda')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}
