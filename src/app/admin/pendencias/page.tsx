import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import PendenciasClient, { type Pendencia } from './PendenciasClient'

export default async function PendenciasPage() {
  const supabase = createAdminSupabaseClient()
  const studioNome = await getStudioNome()

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const { data } = await supabase
    .from('agendamentos')
    .select('id, cliente_nome, cliente_telefone, data, hora_inicio, hora_fim, observacao, servicos(nome)')
    .eq('status', 'confirmado')
    .lt('data', hoje)
    .order('data', { ascending: false })
    .order('hora_inicio', { ascending: false })

  const pendencias: Pendencia[] = (data ?? []).map(a => ({
    id: a.id,
    cliente_nome: a.cliente_nome,
    cliente_telefone: a.cliente_telefone,
    data: a.data,
    hora_inicio: a.hora_inicio,
    hora_fim: a.hora_fim,
    observacao: a.observacao ?? null,
    servico_nome: (a.servicos as unknown as { nome: string } | null)?.nome ?? '—',
  }))

  return <PendenciasClient pendencias={pendencias} studioNome={studioNome} />
}
