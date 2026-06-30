-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security) — executar no Supabase SQL Editor
-- Painel Supabase → SQL Editor → New query → cole e execute
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE servicos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- ─── servicos ────────────────────────────────────────────────────────────────
-- Clientes podem ler apenas serviços ativos (para a página de agendamento)
CREATE POLICY "anon_read_servicos" ON servicos
  FOR SELECT TO anon
  USING (ativo = true);

-- ─── slots ───────────────────────────────────────────────────────────────────
-- Clientes podem ler apenas slots disponíveis (para o calendário público)
CREATE POLICY "anon_read_slots" ON slots
  FOR SELECT TO anon
  USING (disponivel = true);

-- ─── bloqueios ───────────────────────────────────────────────────────────────
-- Clientes precisam ler bloqueios para saber quais datas estão indisponíveis
CREATE POLICY "anon_read_bloqueios" ON bloqueios
  FOR SELECT TO anon
  USING (true);

-- ─── agendamentos ────────────────────────────────────────────────────────────
-- Clientes podem criar agendamentos (ação pública)
-- Não podem ler, alterar ou deletar agendamentos existentes
CREATE POLICY "anon_insert_agendamentos" ON agendamentos
  FOR INSERT TO anon
  WITH CHECK (status = 'confirmado');

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTANTE: o service_role key bypassa RLS automaticamente no Supabase.
-- Todas as operações admin (agenda, horários, serviços, bloqueios, reagendar)
-- usam a chave service_role via src/lib/supabase-admin.ts e nunca são
-- bloqueadas por essas políticas.
-- ─────────────────────────────────────────────────────────────────────────────
