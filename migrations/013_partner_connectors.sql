-- 013_partner_connectors.sql
--
-- Transforma a sincronização de fonte única (EasyCar) em multi-parceiro.
--
-- Cada parceiro que serve estoque passa a ter:
--   sync_source_id   → identidade da fonte, usada em vehicles.source_id
--   connector        → qual adaptador sabe ler o site dele
--   connector_config → base do site, caminho da listagem e filtros
--
-- Parceiro sem connector continua sendo só um rótulo (é o caso das revendas
-- que a API da EasyCar cria sozinha a partir de revenda_nome).

ALTER TABLE partners ADD COLUMN IF NOT EXISTS sync_source_id text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS connector text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS connector_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_connector_check;
ALTER TABLE partners
  ADD CONSTRAINT partners_connector_check
  CHECK (connector IS NULL OR connector IN ('autoconf', 'bndv_next', 'bndv_html', 'guiotti_rsc'));

CREATE UNIQUE INDEX IF NOT EXISTS partners_sync_source_id_key
  ON partners(sync_source_id)
  WHERE sync_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partners_connector_idx
  ON partners(connector, active)
  WHERE connector IS NOT NULL;

-- ── Parceiros-fonte ───────────────────────────────────────────────────
-- Plataformas identificadas em 17/09/2026 analisando cada site:
--   tchescocar → Autoconf, expõe /api/stock em JSON (mesma da EasyCar)
--   justocar   → BNDV, dados em __NEXT_DATA__ de /seminovos?pag=N
--   nowcar     → BNDV em site próprio, listagem em HTML + página de detalhe
--   guiotti    → plataforma sobre Supabase, dados no payload RSC de /estoque
--
-- vehicleFilter: 'cars' importa só automóvel. O Guiotti tem 12 motos e 7
-- carros; moto no catálogo de uma revenda de carro poluiria o site e o feed
-- da Meta. Para trazer tudo, troque para 'all' na tela de Parceiros.

INSERT INTO partners(source_id, external_id, name, trade_name, city, stock_url,
                     sync_source_id, connector, connector_config, origin_kind, notes, active)
VALUES
  ('partner_site', 'tchescocar', 'Tchesco Car', 'Tchesco Car',
   '', 'https://tchescocar.com.br/estoque/',
   'tchescocar', 'autoconf',
   '{"baseUrl":"https://tchescocar.com.br","perPage":100,"vehicleFilter":"cars"}'::jsonb,
   'PARTNER', 'Plataforma Autoconf, API /api/stock.', true),

  ('partner_site', 'justocar', 'Justo Car', 'Justo Car',
   '', 'https://justocar.com.br/seminovos?pag=0',
   'justocar', 'bndv_next',
   '{"baseUrl":"https://justocar.com.br","listPath":"/seminovos","pageParam":"pag","startPage":0,"vehicleFilter":"cars"}'::jsonb,
   'PARTNER', 'Plataforma BNDV em Next.js, dados em __NEXT_DATA__.', true),

  ('partner_site', 'guiottimultimarcas', 'Guiotti Multimarcas', 'Guiotti Multimarcas',
   '', 'https://www.guiottimultimarcas.com.br/estoque',
   'guiottimultimarcas', 'guiotti_rsc',
   '{"baseUrl":"https://www.guiottimultimarcas.com.br","listPath":"/estoque","pageParam":"page","startPage":1,"maxPages":8,"vehicleFilter":"cars"}'::jsonb,
   'PARTNER', 'Plataforma sobre Supabase, dados no payload RSC. Tem carros e motos.', true),

  ('partner_site', 'nowcar', 'Now Car Multimarcas', 'Now Car',
   '', 'https://nowcar.com.br/seminovos',
   'nowcar', 'bndv_html',
   '{"baseUrl":"https://nowcar.com.br","listPath":"/seminovos","detailPath":"/detalhes","fetchDetails":true,"vehicleFilter":"cars"}'::jsonb,
   'PARTNER', 'Plataforma BNDV em site próprio, listagem em HTML.', true)
ON CONFLICT (source_id, external_id) DO UPDATE SET
  sync_source_id   = excluded.sync_source_id,
  connector        = excluded.connector,
  connector_config = excluded.connector_config,
  stock_url        = excluded.stock_url,
  trade_name       = excluded.trade_name,
  notes            = excluded.notes,
  updated_at       = now();

-- A EasyCar já sincronizava antes desta migration; recebe a mesma identidade
-- para aparecer na tela de Parceiros junto com as outras fontes.
INSERT INTO partners(source_id, external_id, name, trade_name, city, stock_url,
                     sync_source_id, connector, connector_config, origin_kind, notes, active)
VALUES ('partner_site', 'easycar', 'EasyCar Veículos', 'EasyCar',
        'Osasco', 'https://easycarveiculos.com.br',
        'easycar_scraper', 'autoconf',
        '{"baseUrl":"https://easycarveiculos.com.br","perPage":100,"vehicleFilter":"cars"}'::jsonb,
        'PARTNER', 'Fonte original da sincronizacao.', true)
ON CONFLICT (source_id, external_id) DO UPDATE SET
  sync_source_id   = excluded.sync_source_id,
  connector        = excluded.connector,
  connector_config = excluded.connector_config,
  updated_at       = now();

-- ── Rastreabilidade do veículo ────────────────────────────────────────
-- plate: serve de segunda chave de deduplicação (item "parceiro + placa") e
-- ajuda a detectar o mesmo carro anunciado por dois parceiros ao mesmo tempo.
-- source_url: o anúncio na origem, para o botão "abrir anúncio original".
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text;

CREATE INDEX IF NOT EXISTS vehicles_plate_idx
  ON vehicles(plate)
  WHERE plate IS NOT NULL AND plate <> '';

-- ── Execução por fonte ────────────────────────────────────────────────
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS source_label text;
