import { createAdminSupabaseClient } from './supabase-admin'

export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
): Promise<{ ok: boolean; minutosRestantes?: number }> {
  const supabase = createAdminSupabaseClient()
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  const { data, error } = await supabase
    .from('rate_limits')
    .select('count, reset_at')
    .eq('key', key)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found — tratamos abaixo
    return { ok: true }
  }

  if (!data || new Date(data.reset_at) <= now) {
    // Entrada inexistente ou expirada — cria/reseta
    await supabase.from('rate_limits').upsert(
      { key, count: 1, reset_at: resetAt.toISOString() },
      { onConflict: 'key' },
    )
    return { ok: true }
  }

  if (data.count >= maxAttempts) {
    const minutos = Math.ceil((new Date(data.reset_at).getTime() - now.getTime()) / 60_000)
    return { ok: false, minutosRestantes: minutos }
  }

  await supabase
    .from('rate_limits')
    .update({ count: data.count + 1 })
    .eq('key', key)

  return { ok: true }
}

export async function resetRateLimit(key: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  await supabase.from('rate_limits').delete().eq('key', key)
}
