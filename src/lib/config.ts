import { cache } from 'react'
import { createAdminSupabaseClient } from './supabase-admin'

export const getStudioNome = cache(async (): Promise<string> => {
  try {
    const supabase = createAdminSupabaseClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'studio_nome')
      .single()
    if (data?.valor) return data.valor
  } catch {
    // tabela pode não existir ainda
  }
  return process.env.NEXT_PUBLIC_STUDIO_NAME ?? 'Studio'
})
