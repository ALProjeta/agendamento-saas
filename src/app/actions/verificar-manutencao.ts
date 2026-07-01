'use server'

import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export type VerificacaoResult =
  | { elegivel: true; nome: string; telefone: string; ultimoServico: string }
  | { elegivel: false; erro: string }

export async function verificarElegibilidade(telefone: string): Promise<VerificacaoResult> {
  const digits = telefone.replace(/\D/g, '')
  if (digits.length < 8) return { elegivel: false, erro: 'Informe um número de WhatsApp válido.' }

  // Janela de 90 dias
  const limite = new Date()
  limite.setDate(limite.getDate() - 90)
  const limiteStr = limite.toISOString().slice(0, 10)

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('agendamentos')
    .select('cliente_nome, cliente_telefone, data')
    .eq('status', 'concluido')
    .gte('data', limiteStr)
    .ilike('cliente_telefone', `%${digits.slice(-9)}%`)
    .order('data', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) {
    return {
      elegivel: false,
      erro: 'Não encontramos um serviço recente associado a esse número. A manutenção é exclusiva para clientes que realizaram um serviço nos últimos 90 dias.',
    }
  }

  return {
    elegivel: true,
    nome: data[0].cliente_nome as string,
    telefone: data[0].cliente_telefone as string,
    ultimoServico: data[0].data as string,
  }
}
