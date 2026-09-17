-- 015_fotos_tratadas_e_trava.sql
--
-- Permite substituir as fotos de um veículo pelas versões tratadas com o fundo
-- do estúdio AutoDrive e TRAVAR essa troca, para a sincronização não devolver
-- as fotos da origem no ciclo seguinte.
--
-- O problema que isto resolve: o parceiro atualiza o anúncio, o sync reimporta
-- e sobrescreve as fotos tratadas pelas originais. Sem a trava, o trabalho de
-- tratamento se repetiria para sempre, a cada 15 minutos, até o carro vender.
--
--   photos_locked     → sync não mexe em image_url nem images
--   images_original   → guarda as fotos da origem, para poder voltar atrás
--   photos_status     → em que ponto do fluxo de tratamento o veículo está
--
-- Regra de negócio: a trava é do VEÍCULO, não da foto. Carro vendido ou
-- despublicado simplesmente sai do ar; a trava deixa de importar e o histórico
-- permanece.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photos_locked boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photos_locked_at timestamptz;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photos_locked_by text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS images_original jsonb;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photos_status text NOT NULL DEFAULT 'ORIGEM';

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_photos_status_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_photos_status_check
  CHECK (photos_status IN ('ORIGEM', 'EM_TRATAMENTO', 'TRATADA'));

-- Fila de trabalho: quem ainda precisa de tratamento, os mais novos primeiro.
CREATE INDEX IF NOT EXISTS vehicles_photos_pendentes_idx
  ON vehicles(photos_status, created_at DESC)
  WHERE status = 'published' AND photos_locked = false;

-- Registro de cada troca de fotos, para auditoria e para saber o que reverter.
CREATE TABLE IF NOT EXISTS vehicle_photo_runs (
  id bigserial PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  acao text NOT NULL,
  fotos_antes integer NOT NULL DEFAULT 0,
  fotos_depois integer NOT NULL DEFAULT 0,
  feito_por text NOT NULL DEFAULT 'admin',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_photo_runs DROP CONSTRAINT IF EXISTS vehicle_photo_runs_acao_check;
ALTER TABLE vehicle_photo_runs
  ADD CONSTRAINT vehicle_photo_runs_acao_check
  CHECK (acao IN ('SUBSTITUIR', 'ADICIONAR', 'EXCLUIR', 'TRAVAR', 'DESTRAVAR', 'RESTAURAR'));

CREATE INDEX IF NOT EXISTS vehicle_photo_runs_vehicle_idx
  ON vehicle_photo_runs(vehicle_id, created_at DESC);
