ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'available';

UPDATE vehicles
SET stock_status = 'sold'
WHERE status = 'sold' AND stock_status = 'available';

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_stock_status_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_stock_status_check
  CHECK (stock_status IN ('available', 'reserved', 'sold'));

CREATE INDEX IF NOT EXISTS vehicles_meta_feed_idx
  ON vehicles(status, stock_status, updated_at DESC);

INSERT INTO site_settings(key, value) VALUES
  ('meta_availability_published', 'in stock'),
  ('meta_availability_reserved', 'out of stock'),
  ('meta_availability_sold', 'exclude'),
  ('meta_default_image_url', 'https://www.dagobertoeasycar.com.br/em-breve.jpg'),
  ('meta_include_without_images', 'false'),
  ('meta_catalog_id', ''),
  ('meta_business_portfolio', ''),
  ('meta_whatsapp_account', ''),
  ('meta_facebook_page', ''),
  ('meta_phone_number', '+55 11 93471-8276'),
  ('meta_data_source_id', ''),
  ('meta_last_import_status', ''),
  ('meta_last_import_at', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS meta_feed_validations (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  exported INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

