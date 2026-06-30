-- Crie esta tabela no SQL Editor do Supabase antes de usar a página de Configurações

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT ''
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Leitura pública (clientes podem ler o nome do estúdio e formas de pagamento)
CREATE POLICY "anon_read_configuracoes" ON configuracoes
  FOR SELECT TO anon USING (true);

-- Valores padrão
INSERT INTO configuracoes (chave, valor) VALUES
  ('studio_nome',         'Studio'),
  ('pix_habilitado',      'true'),
  ('pix_chave',           ''),
  ('pix_descricao',       'Transferência instantânea'),
  ('cartao_habilitado',   'true'),
  ('cartao_descricao',    'Crédito ou débito'),
  ('dinheiro_habilitado', 'true')
ON CONFLICT (chave) DO NOTHING;
