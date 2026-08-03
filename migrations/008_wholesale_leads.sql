ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cnpj text;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_kind_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_kind_check
  CHECK (kind IN ('contact', 'financing', 'sell_car', 'wholesale'));

CREATE INDEX IF NOT EXISTS leads_wholesale_idx
  ON leads(kind, status, created_at DESC);
