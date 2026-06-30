import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import AgendaClient, { type Agendamento, type DayData } from './AgendaClient'

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function getMondayOfWeek(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; modo?: string }>
}) {
  const { data: dateParam, modo } = await searchParams
  const dateStr = dateParam ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const isSemana = modo === 'semana'

  const supabase = createAdminSupabaseClient()
  const studioNome = await getStudioNome()

  let diasData: DayData[]

  if (isSemana) {
    const monday = getMondayOfWeek(dateStr)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return toStr(d)
    })

    const { data: rows } = await supabase
      .from('agendamentos')
      .select('id, cliente_nome, cliente_telefone, status, data, hora_inicio, hora_fim, observacao, servico:servico_id(nome, duracao_minutos, preco)')
      .gte('data', days[0])
      .lte('data', days[6])
      .order('data')
      .order('hora_inicio')

    const agByDate = new Map<string, Agendamento[]>(days.map(d => [d, []]))
    for (const row of (rows ?? [])) {
      const list = agByDate.get(row.data)
      if (!list) continue
      list.push({
        id:               row.id,
        cliente_nome:     row.cliente_nome,
        cliente_telefone: row.cliente_telefone,
        status:           row.status as Agendamento['status'],
        data:             row.data,
        hora_inicio:      row.hora_inicio,
        hora_fim:         row.hora_fim,
        observacao:       row.observacao,
        servico: (Array.isArray(row.servico) ? row.servico[0] : row.servico) as Agendamento['servico'],
      })
    }

    diasData = days.map(d => ({ dateStr: d, agendamentos: agByDate.get(d) ?? [] }))
  } else {
    const { data: rows } = await supabase
      .from('agendamentos')
      .select('id, cliente_nome, cliente_telefone, status, data, hora_inicio, hora_fim, observacao, servico:servico_id(nome, duracao_minutos, preco)')
      .eq('data', dateStr)
      .order('hora_inicio')

    const agendamentos: Agendamento[] = (rows ?? []).map(row => ({
      id:               row.id,
      cliente_nome:     row.cliente_nome,
      cliente_telefone: row.cliente_telefone,
      status:           row.status as Agendamento['status'],
      data:             row.data,
      hora_inicio:      row.hora_inicio,
      hora_fim:         row.hora_fim,
      observacao:       row.observacao,
      servico: (Array.isArray(row.servico) ? row.servico[0] : row.servico) as Agendamento['servico'],
    }))
    diasData = [{ dateStr, agendamentos }]
  }

  return <AgendaClient diasData={diasData} dateStr={dateStr} modo={isSemana ? 'semana' : 'dia'} studioNome={studioNome} />
}
