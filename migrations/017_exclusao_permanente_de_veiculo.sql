-- 017_exclusao_permanente_de_veiculo.sql
--
-- Faz o botão "Excluir" do painel valer alguma coisa.
--
-- O problema: a sincronização faz upsert por (source_id, external_id) e força
-- status='published'. Um veículo apagado à mão voltava publicado no ciclo
-- seguinte, no máximo 15 minutos depois. Quem apagou concluía que o painel
-- estava quebrado — e estava mesmo, do ponto de vista dele.
--
-- A solução é uma lista de bloqueio consultada pelo sync antes de gravar.
-- Bloqueio é por origem + id externo, não por linha de vehicles: o registro
-- some, a decisão fica.
--
-- Para voltar atrás, basta apagar a linha correspondente daqui; o veículo
-- reaparece na próxima sincronização.

CREATE TABLE IF NOT EXISTS vehicle_blocklist (
  id bigserial PRIMARY KEY,
  source_id text NOT NULL,
  external_id text NOT NULL,
  titulo text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  bloqueado_por text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_blocklist_chave_idx
  ON vehicle_blocklist(source_id, external_id);

-- Nota sobre a arte da loja (logotipo do parceiro, composição com o nome da
-- revenda): não há limpeza de dados aqui de propósito. O filtro entrou em
-- normalizeVehicle, e o sync regrava `images` de todo veículo sem trava a cada
-- ciclo. Quem está travado guarda foto tratada, que também não deve ser mexida.
-- Ou seja: o estoque se corrige sozinho na primeira sincronização depois deste
-- deploy, sem UPDATE em massa sobre jsonb.
