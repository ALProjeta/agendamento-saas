ALTER TABLE agendamentos DROP CONSTRAINT agendamentos_status_valido;

ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_valido
  CHECK (status IN ('confirmado', 'cancelado', 'concluido', 'no_show'));
