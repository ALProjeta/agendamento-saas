-- Adiciona flag de manutenção nos serviços
-- Execute no SQL Editor do Supabase

ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS apenas_manutencao BOOLEAN NOT NULL DEFAULT FALSE;
