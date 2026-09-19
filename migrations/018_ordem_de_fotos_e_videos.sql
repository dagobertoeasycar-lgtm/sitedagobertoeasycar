-- 018_ordem_de_fotos_e_videos.sql
--
-- Permite um video proprio por veiculo e um video padrao para os anuncios.
-- A ordem das fotos continua no jsonb `images`; REORDENAR entra na auditoria
-- das alteracoes manuais da galeria.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS video_url text;

INSERT INTO site_settings(key, value)
VALUES ('default_vehicle_video_url', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE vehicle_photo_runs DROP CONSTRAINT IF EXISTS vehicle_photo_runs_acao_check;
ALTER TABLE vehicle_photo_runs
  ADD CONSTRAINT vehicle_photo_runs_acao_check
  CHECK (acao IN ('SUBSTITUIR', 'ADICIONAR', 'EXCLUIR', 'TRAVAR', 'DESTRAVAR', 'RESTAURAR', 'REORDENAR'));
