import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'
import ClientesClient, { type ClienteData } from './ClientesClient'

export default async function ClientesPage() {
  const [supabase, studioNome] = [createAdminSupabaseClient(), await getStudioNome()]

  const { data: ags } = await supabase
    .from('agendamentos')
    .select('cliente_nome, cliente_telefone, status, data')

  const mapa = new Map<string, ClienteData>()
  for (const ag of (ags ?? [])) {
    const tel = ag.cliente_telefone as string
    const agData = ag.data as string | null
    if (!mapa.has(tel)) {
      mapa.set(tel, {
        nome: ag.cliente_nome as string,
        telefone: tel,
        total: ag.status !== 'cancelado' ? 1 : 0,
        ultimo_data: agData,
      })
    } else {
      const entry = mapa.get(tel)!
      if (ag.status !== 'cancelado') entry.total++
      if (agData && (!entry.ultimo_data || agData > entry.ultimo_data)) {
        entry.ultimo_data = agData
      }
    }
  }

  for (const [tel, entry] of mapa) {
    if (entry.total === 0) mapa.delete(tel)
  }

  const clientes = [...mapa.values()].sort((a, b) => {
    if (!a.ultimo_data && !b.ultimo_data) return 0
    if (!a.ultimo_data) return 1
    if (!b.ultimo_data) return -1
    return b.ultimo_data.localeCompare(a.ultimo_data)
  })

  return <ClientesClient clientes={clientes} studioNome={studioNome} />
}
