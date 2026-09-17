-- 012_pricing_internal_code_availability.sql
--
-- Completa a central de estoque multiorigem:
--   1. preço de origem x acréscimo comercial x preço de publicação
--   2. histórico de alteração de preço do parceiro
--   3. identificação interna AD-PAR / AD-PRI / AD-PRO
--   4. controle de disponibilidade com carência antes de inativar
--   5. configurações da aplicação (regra de preço)
--   6. campos operacionais do parceiro
--
-- Compatibilidade: vehicles.price_cents CONTINUA sendo o preço publicado, que é
-- o que todo o site já lê. O preço do parceiro passa a viver em
-- origin_price_cents. Nada que hoje lê price_cents precisa mudar.

-- ── 1. Preço ──────────────────────────────────────────────────────────
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS origin_price_cents integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_markup_cents integer NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_markup_mode text NOT NULL DEFAULT 'auto';

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_price_markup_mode_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_price_markup_mode_check
  CHECK (price_markup_mode IN ('auto', 'manual', 'none'));

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_price_markup_cents_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_price_markup_cents_check
  CHECK (price_markup_cents >= 0);

-- Estoque que já existe: o preço atual passa a ser também o preço de origem,
-- sem acréscimo, para não alterar nenhum valor anunciado hoje.
UPDATE vehicles
   SET origin_price_cents = price_cents,
       price_markup_cents = 0,
       price_markup_mode  = 'none'
 WHERE origin_price_cents IS NULL;

-- ── 2. Histórico de preço ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_price_history (
  id bigserial PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  previous_origin_price_cents integer,
  new_origin_price_cents integer NOT NULL,
  previous_published_price_cents integer,
  new_published_price_cents integer NOT NULL,
  markup_cents integer NOT NULL DEFAULT 0,
  changed_by text NOT NULL DEFAULT 'sync',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_price_history_vehicle_idx
  ON vehicle_price_history(vehicle_id, created_at DESC);

-- ── 3. Identificação interna ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS vehicle_code_own_seq;
CREATE SEQUENCE IF NOT EXISTS vehicle_code_partner_seq;
CREATE SEQUENCE IF NOT EXISTS vehicle_code_private_seq;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS internal_code text;

CREATE OR REPLACE FUNCTION vehicle_next_internal_code(origin text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF origin = 'PRIVATE' THEN
    RETURN 'AD-PRI-' || lpad(nextval('vehicle_code_private_seq')::text, 6, '0');
  ELSIF origin = 'OWN' THEN
    RETURN 'AD-PRO-' || lpad(nextval('vehicle_code_own_seq')::text, 6, '0');
  ELSE
    RETURN 'AD-PAR-' || lpad(nextval('vehicle_code_partner_seq')::text, 6, '0');
  END IF;
END;
$$;

-- O código é atribuído uma única vez e nunca muda, mesmo que a origem mude
-- depois — é o identificador de rastreabilidade do veículo.
CREATE OR REPLACE FUNCTION vehicles_assign_internal_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.internal_code IS NULL OR btrim(NEW.internal_code) = '' THEN
    NEW.internal_code := vehicle_next_internal_code(COALESCE(NEW.origin_type, 'PARTNER'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_internal_code_trg ON vehicles;
CREATE TRIGGER vehicles_internal_code_trg
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION vehicles_assign_internal_code();

-- Backfill do estoque existente, na ordem de cadastro.
DO $$
DECLARE
  registro record;
BEGIN
  FOR registro IN
    SELECT id, COALESCE(origin_type, 'PARTNER') AS origin_type
      FROM vehicles
     WHERE internal_code IS NULL OR btrim(internal_code) = ''
     ORDER BY created_at, id
  LOOP
    UPDATE vehicles
       SET internal_code = vehicle_next_internal_code(registro.origin_type)
     WHERE id = registro.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_internal_code_key
  ON vehicles(internal_code)
  WHERE internal_code IS NOT NULL;

-- ── 4. Disponibilidade com carência ───────────────────────────────────
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'DISPONIVEL';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS missing_checks integer NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_availability_status_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_availability_status_check
  CHECK (availability_status IN ('DISPONIVEL', 'POSSIVELMENTE_INDISPONIVEL', 'INDISPONIVEL'));

UPDATE vehicles SET last_seen_at = COALESCE(last_seen_at, updated_at);

CREATE INDEX IF NOT EXISTS vehicles_availability_idx
  ON vehicles(availability_status, updated_at DESC);

-- ── 5. Configurações da aplicação ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Regra comercial de preço. mode:
--   range  → sorteia/aplica entre min e max (usa min como piso previsível)
--   fixed  → sempre o valor de fixed_cents
--   none   → não aplica acréscimo
INSERT INTO app_settings(key, value)
VALUES (
  'pricing_rule',
  '{"mode":"range","min_cents":200000,"max_cents":300000,"fixed_cents":250000,"round_to_cents":10000,"apply_to":["PARTNER","PRIVATE"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Quantas execuções sem encontrar o veículo antes de marcar como indisponível.
INSERT INTO app_settings(key, value)
VALUES ('stock_rule', '{"missing_checks_before_inactive":2}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── 6. Campos operacionais do parceiro ────────────────────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS stock_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS stock_url_alt text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS origin_kind text NOT NULL DEFAULT 'PARTNER';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_found integer NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_imported integer NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_changed integer NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_removed integer NOT NULL DEFAULT 0;

ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_origin_kind_check;
ALTER TABLE partners
  ADD CONSTRAINT partners_origin_kind_check
  CHECK (origin_kind IN ('PARTNER', 'PRIVATE', 'OWN'));

CREATE INDEX IF NOT EXISTS partners_active_idx ON partners(active, name);

-- ── 7. Execução do sync por parceiro ──────────────────────────────────
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS price_changed integer NOT NULL DEFAULT 0;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS unchanged integer NOT NULL DEFAULT 0;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS missing integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS sync_runs_recent_idx ON sync_runs(started_at DESC);
