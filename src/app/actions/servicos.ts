'use server'

import { revalidatePath } from 'next/cache'
import { verificarAdmin } from '@/lib/auth-admin'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

function revalidar() {
  revalidatePath('/admin/servicos')
  revalidatePath('/')
  revalidatePath('/manutencao')
}

export type ServicoResult = { ok: true } | { ok: false; erro: string }

export async function criarServico(
  nome: string,
  duracao_minutos: number,
  preco: number,
  apenas_manutencao = false,
): Promise<ServicoResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('servicos')
    .insert({ nome: nome.trim(), duracao_minutos, preco, ativo: true, apenas_manutencao })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarServico(
  id: string,
  nome: string,
  duracao_minutos: number,
  preco: number,
  apenas_manutencao = false,
): Promise<ServicoResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('servicos')
    .update({ nome: nome.trim(), duracao_minutos, preco, apenas_manutencao })
    .eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function toggleAtivo(id: string, ativo: boolean): Promise<ServicoResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('servicos').update({ ativo }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}
