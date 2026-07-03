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

export async function uploadFotoServico(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { ok: false, erro: 'Nenhum arquivo selecionado.' }

  const supabase = createAdminSupabaseClient()
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('servicos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return { ok: false, erro: error.message }

  const { data: urlData } = supabase.storage.from('servicos').getPublicUrl(data.path)
  return { ok: true, url: urlData.publicUrl }
}

export async function criarServico(
  nome: string,
  duracao_minutos: number,
  preco: number,
  apenas_manutencao = false,
  foto_url: string | null = null,
): Promise<ServicoResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('servicos')
    .insert({ nome: nome.trim(), duracao_minutos, preco, ativo: true, apenas_manutencao, foto_url })
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
  foto_url: string | null = null,
): Promise<ServicoResult> {
  try { await verificarAdmin() } catch { return { ok: false, erro: 'Não autorizado.' } }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('servicos')
    .update({ nome: nome.trim(), duracao_minutos, preco, apenas_manutencao, foto_url })
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
