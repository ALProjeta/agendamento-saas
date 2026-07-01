'use server'

import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export type VerificacaoResult =
  | { elegivel: true; nome: string; telefone: string; ultimoServico: string }
  | { elegivel: false; erro: string }

export async function verificarElegibilidade(telefone: string): Promise<VerificacaoResult> {
  const inputDigits = telefone.replace(/\D/g, '')

  // Telefone brasileiro: DDD (2) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
  if (inputDigits.length < 10 || inputDigits.length > 11) {
    return { elegivel: false, erro: 'Informe DDD + número completo. Ex: 11999998888' }
  }

  // Janela de 30 dias
  const limite = new Date()
  limite.setDate(limite.getDate() - 30)
  const limiteStr = limite.toISOString().slice(0, 10)

  const supabase = createAdminSupabaseClient()

  // Busca todos os agendamentos concluídos na janela para comparação exata
  const { data } = await supabase
    .from('agendamentos')
    .select('cliente_nome, cliente_telefone, data')
    .eq('status', 'concluido')
    .gte('data', limiteStr)
    .order('data', { ascending: false })

  if (!data || data.length === 0) {
    return {
      elegivel: false,
      erro: 'Não encontramos um serviço recente para esse número. A manutenção é exclusiva para clientes que realizaram um serviço nos últimos 30 dias.',
    }
  }

  // Compara apenas os dígitos, considerando que o armazenado pode ter formatação
  const match = data.find(a => {
    const storedDigits = String(a.cliente_telefone ?? '').replace(/\D/g, '')
    // Compara os últimos N dígitos onde N = tamanho do input (10 ou 11)
    return storedDigits.slice(-inputDigits.length) === inputDigits
  })

  if (!match) {
    return {
      elegivel: false,
      erro: 'Não encontramos um serviço recente para esse número. A manutenção é exclusiva para clientes que realizaram um serviço nos últimos 30 dias.',
    }
  }

  return {
    elegivel: true,
    nome: match.cliente_nome as string,
    telefone: match.cliente_telefone as string,
    ultimoServico: match.data as string,
  }
}
