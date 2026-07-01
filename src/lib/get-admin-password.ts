import { createAdminSupabaseClient } from './supabase-admin'

export async function getAdminPassword(): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'admin_password')
      .maybeSingle()
    if (data?.valor) return data.valor
  } catch {}
  return process.env.ADMIN_PASSWORD ?? ''
}
