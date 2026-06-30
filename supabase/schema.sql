-- ============================================================
-- Schema: Sistema de Agendamento com Horários Flexíveis
-- ============================================================

-- ============================================================
-- TABELA: servicos
-- ============================================================
CREATE TABLE servicos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT        NOT NULL,
  duracao_minutos  INTEGER     NOT NULL,
  preco            DECIMAL     NOT NULL,
  ativo            BOOLEAN     NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: slots
-- ============================================================
CREATE TABLE slots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE        NOT NULL,
  hora_inicio TIME        NOT NULL,
  hora_fim    TIME        NOT NULL,
  disponivel  BOOLEAN     NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT slots_hora_valida CHECK (hora_fim > hora_inicio)
);

-- ============================================================
-- TABELA: bloqueios
-- ============================================================
CREATE TABLE bloqueios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio DATE        NOT NULL,
  data_fim    DATE        NOT NULL,
  motivo      TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bloqueios_datas_validas CHECK (data_fim >= data_inicio)
);

-- ============================================================
-- TABELA: agendamentos
-- ============================================================
CREATE TABLE agendamentos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id          UUID        NOT NULL REFERENCES slots(id)    ON DELETE RESTRICT,
  servico_id       UUID        NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
  cliente_nome     TEXT        NOT NULL,
  cliente_telefone TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'confirmado',
  observacao       TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agendamentos_status_valido
    CHECK (status IN ('confirmado', 'cancelado', 'concluido'))
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Busca de slots por data (listagem de disponibilidade)
CREATE INDEX idx_slots_data ON slots(data);

-- Busca de slots disponíveis por data
CREATE INDEX idx_slots_data_disponivel ON slots(data, disponivel);

-- Busca de bloqueios por intervalo de datas
CREATE INDEX idx_bloqueios_datas ON bloqueios(data_inicio, data_fim);

-- Busca de agendamentos por slot
CREATE INDEX idx_agendamentos_slot_id ON agendamentos(slot_id);

-- Busca de agendamentos por status
CREATE INDEX idx_agendamentos_status ON agendamentos(status);

-- ============================================================
-- REGRA: um slot só pode ter um agendamento ativo por vez
-- ============================================================
CREATE UNIQUE INDEX idx_agendamentos_slot_ativo
  ON agendamentos(slot_id)
  WHERE status = 'confirmado';

-- ============================================================
-- TRIGGER: marca slot como indisponível ao confirmar agendamento
-- ============================================================
CREATE OR REPLACE FUNCTION marcar_slot_indisponivel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmado' THEN
    UPDATE slots SET disponivel = false WHERE id = NEW.slot_id;
  END IF;

  IF NEW.status IN ('cancelado', 'concluido') AND
     (TG_OP = 'UPDATE' AND OLD.status = 'confirmado') THEN
    UPDATE slots SET disponivel = true WHERE id = NEW.slot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agendamento_slot
  AFTER INSERT OR UPDATE OF status ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION marcar_slot_indisponivel();
