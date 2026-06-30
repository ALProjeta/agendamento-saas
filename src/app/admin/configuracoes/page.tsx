import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import ConfiguracoesClient from './ConfiguracoesClient'

export default async function ConfigPage() {
  let cfg: Record<string, string> = {}
  let tableNotFound = false

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase.from('configuracoes').select('chave, valor')
    if (error?.code === '42P01') {
      tableNotFound = true
    } else {
      for (const row of (data ?? [])) cfg[row.chave] = row.valor
    }
  } catch {
    tableNotFound = true
  }

  return <ConfiguracoesClient config={cfg} tableNotFound={tableNotFound} />
}
