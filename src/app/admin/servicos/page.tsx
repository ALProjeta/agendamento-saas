import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import ServicosClient, { type Servico } from './ServicosClient'

export default async function ServicosPage() {
  const [supabase, studioNome] = [createAdminSupabaseClient(), await getStudioNome()]

  const { data } = await supabase
    .from('servicos')
    .select('id, nome, duracao_minutos, preco, ativo, apenas_manutencao')
    .order('ativo', { ascending: false })
    .order('nome')

  const servicos: Servico[] = data ?? []

  return <ServicosClient servicos={servicos} studioNome={studioNome} />
}
