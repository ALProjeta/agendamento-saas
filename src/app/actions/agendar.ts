'use server'

import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/lib/rate-limit'

export type AgendarInput = {
  disponibilidade_id: string
  data: string
  hora_inicio: string
  servico_id: string
  cliente_nome: string
  cliente_telefone: string
  observacao?: string
}

export type AgendarResult =
  | { ok: true }
  | { ok: false; erro: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export async function agendar(input: AgendarInput): Promise<AgendarResult> {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const limit = await checkRateLimit(`booking:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false, erro: 'Muitos agendamentos em pouco tempo. Tente novamente mais tarde.' }
  }

  const nomeTrimmed = input.cliente_nome.trim()
  const telDigits   = input.cliente_telefone.replace(/\D/g, '')

  if (nomeTrimmed.length < 2)   return { ok: false, erro: 'Nome muito curto. Informe seu nome completo.' }
  if (nomeTrimmed.length > 100) return { ok: false, erro: 'Nome muito longo (máx. 100 caracteres).' }
  if (telDigits.length < 10)   return { ok: false, erro: 'Telefone inválido. Informe DDD + número (mínimo 10 dígitos).' }
  if (telDigits.length > 15)   return { ok: false, erro: 'Telefone inválido.' }
  if (input.observacao && input.observacao.trim().length > 500)
    return { ok: false, erro: 'Observação muito longa (máx. 500 caracteres).' }
  if (!UUID_RE.test(input.disponibilidade_id)) return { ok: false, erro: 'Horário inválido.' }
  if (!UUID_RE.test(input.servico_id))         return { ok: false, erro: 'Serviço inválido.' }
  if (!DATE_RE.test(input.data))               return { ok: false, erro: 'Data inválida.' }
  if (!TIME_RE.test(input.hora_inicio))        return { ok: false, erro: 'Horário inválido.' }

  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()

  const { data: servico } = await supabase
    .from('servicos')
    .select('duracao_minutos')
    .eq('id', input.servico_id)
    .eq('ativo', true)
    .single()

  if (!servico) return { ok: false, erro: 'Serviço não encontrado.' }

  const horaIniMin = timeToMin(input.hora_inicio)
  const horaFimMin = horaIniMin + servico.duracao_minutos
  const horaFim    = minToTime(horaFimMin)

  const { data: disp } = await supabase
    .from('disponibilidades')
    .select('hora_inicio, hora_fim')
    .eq('id', input.disponibilidade_id)
    .eq('data', input.data)
    .single()

  if (!disp) return { ok: false, erro: 'Janela de disponibilidade não encontrada.' }

  if (horaIniMin < timeToMin(disp.hora_inicio) || horaFimMin > timeToMin(disp.hora_fim)) {
    return { ok: false, erro: 'Horário fora da janela disponível.' }
  }

  const { data: conflitos } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('data', input.data)
    .neq('status', 'cancelado')
    .lt('hora_inicio', horaFim)
    .gt('hora_fim', input.hora_inicio)
    .limit(1)

  if (conflitos && conflitos.length > 0) {
    return { ok: false, erro: 'Este horário acabou de ser reservado. Por favor, escolha outro.' }
  }

  const { error } = await adminSupabase.from('agendamentos').insert({
    data:             input.data,
    hora_inicio:      input.hora_inicio,
    hora_fim:         horaFim,
    servico_id:       input.servico_id,
    cliente_nome:     nomeTrimmed,
    cliente_telefone: telDigits,
    status:           'confirmado',
    observacao:       input.observacao?.trim() || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, erro: 'Este horário acabou de ser reservado. Por favor, escolha outro.' }
    }
    return { ok: false, erro: 'Erro ao confirmar agendamento. Tente novamente.' }
  }

  return { ok: true }
}
