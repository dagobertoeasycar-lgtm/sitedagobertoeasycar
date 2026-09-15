CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL DEFAULT 'manual',
  external_id text NOT NULL DEFAULT (gen_random_uuid())::text,
  name text NOT NULL,
  legal_name text,
  cnpj text,
  responsible_name text,
  whatsapp text,
  email text,
  city text NOT NULL DEFAULT '',
  address text,
  instagram text,
  website text,
  average_inventory integer,
  current_system text,
  desired_work jsonb NOT NULL DEFAULT '[]'::jsonb,
  commission text,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS private_vehicle_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  city text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'PARTNER';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS private_owner_id uuid REFERENCES private_vehicle_owners(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS partner_external_id text NOT NULL DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '';

UPDATE vehicles
   SET origin_type = CASE
     WHEN source_id = 'easycar_scraper' OR NULLIF(BTRIM(store), '') IS NOT NULL THEN 'PARTNER'
     ELSE 'OWN'
   END
 WHERE partner_id IS NULL
   AND private_owner_id IS NULL;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_origin_type_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_origin_type_check
  CHECK (origin_type IN ('OWN', 'PARTNER', 'PRIVATE'));

INSERT INTO partners(source_id, external_id, name, city, notes)
SELECT 'legacy_vehicle_store',
       md5(BTRIM(store)),
       BTRIM(store),
       COALESCE(NULLIF(split_part(max(city), '/', 1), ''), ''),
       'Parceiro criado automaticamente a partir do estoque existente.'
  FROM vehicles
 WHERE NULLIF(BTRIM(store), '') IS NOT NULL
 GROUP BY BTRIM(store)
ON CONFLICT (source_id, external_id) DO UPDATE
  SET name = EXCLUDED.name,
      city = EXCLUDED.city,
      updated_at = now();

UPDATE vehicles v
   SET partner_id = p.id
  FROM partners p
 WHERE v.partner_id IS NULL
   AND v.origin_type = 'PARTNER'
   AND p.source_id = 'legacy_vehicle_store'
   AND p.external_id = md5(BTRIM(v.store));

CREATE INDEX IF NOT EXISTS vehicles_origin_type_idx
  ON vehicles(origin_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS vehicles_partner_idx
  ON vehicles(partner_id)
  WHERE partner_id IS NOT NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vehicle_origin_type text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_kind_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_kind_check
  CHECK (kind IN ('contact', 'financing', 'sell_car', 'wholesale', 'partner', 'find_car', 'vehicle_interest'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_vehicle_origin_type_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_vehicle_origin_type_check
  CHECK (vehicle_origin_type IS NULL OR vehicle_origin_type IN ('OWN', 'PARTNER', 'PRIVATE'));

CREATE INDEX IF NOT EXISTS leads_tracking_idx
  ON leads(kind, lead_source, created_at DESC);

CREATE INDEX IF NOT EXISTS leads_vehicle_idx
  ON leads(vehicle_id)
  WHERE vehicle_id IS NOT NULL;
