import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import HorariosClient, { type Disponibilidade } from './HorariosClient'

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const { data: dateParam } = await searchParams
  const dateStr = dateParam ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const supabase = createAdminSupabaseClient()
  const studioNome = await getStudioNome()

  const { data: servicosData } = await supabase
    .from('servicos')
    .select('id, nome, duracao_minutos')
    .eq('ativo', true)
    .order('nome')
  const servicos = servicosData ?? []

  const { data: dispData } = await supabase
    .from('disponibilidades')
    .select('id, hora_inicio, hora_fim')
    .eq('data', dateStr)
    .order('hora_inicio')
  const disponibilidades: Disponibilidade[] = (dispData ?? []).map(d => ({
    id: d.id,
    hora_inicio: d.hora_inicio,
    hora_fim: d.hora_fim,
  }))

  const { data: agsData } = await supabase
    .from('agendamentos')
    .select('hora_inicio, hora_fim, cliente_nome, servico:servico_id(nome)')
    .eq('data', dateStr)
    .neq('status', 'cancelado')
    .order('hora_inicio')

  const agendamentos = (agsData ?? []).map(a => ({
    hora_inicio: a.hora_inicio as string,
    hora_fim:    a.hora_fim as string,
    cliente_nome: a.cliente_nome as string,
    servico_nome: (Array.isArray(a.servico) ? a.servico[0] : a.servico as { nome: string } | null)?.nome ?? '',
  }))

  const { data: todasDatas } = await supabase
    .from('disponibilidades')
    .select('data')
  const datasComDisp = [...new Set((todasDatas ?? []).map(d => d.data as string))]

  return (
    <HorariosClient
      dateStr={dateStr}
      disponibilidades={disponibilidades}
      agendamentos={agendamentos}
      datasComDisp={datasComDisp}
      studioNome={studioNome}
      servicos={servicos}
    />
  )
}
