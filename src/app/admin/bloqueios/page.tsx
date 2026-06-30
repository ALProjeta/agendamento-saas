import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import BloqueiosClient, { type Bloqueio } from './BloqueiosClient'

export default async function BloqueiosPage() {
  const [supabase, studioNome] = [createAdminSupabaseClient(), await getStudioNome()]

  // Limpeza passiva: remove bloqueios encerrados há mais de 60 dias
  const limite60d = new Date()
  limite60d.setDate(limite60d.getDate() - 60)
  supabase.from('bloqueios').delete().lt('data_fim', limite60d.toISOString().slice(0, 10))
    .then(() => {}).catch(() => {})

  const { data } = await supabase
    .from('bloqueios')
    .select('id, data_inicio, data_fim, motivo, criado_em')
    .order('data_inicio', { ascending: true })

  const bloqueios: Bloqueio[] = data ?? []

  return <BloqueiosClient bloqueios={bloqueios} studioNome={studioNome} />
}
