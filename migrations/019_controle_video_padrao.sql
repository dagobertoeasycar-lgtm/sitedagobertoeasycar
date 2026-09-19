-- 019_controle_video_padrao.sql
--
-- Permite pausar o video padrao sem apagar o arquivo. Videos proprios dos
-- veiculos continuam ativos e sempre tem prioridade sobre o padrao.

INSERT INTO site_settings(key, value)
SELECT
  'default_vehicle_video_enabled',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM site_settings
      WHERE key = 'default_vehicle_video_url' AND btrim(value) <> ''
    ) THEN 'true'
    ELSE 'false'
  END
ON CONFLICT (key) DO NOTHING;
