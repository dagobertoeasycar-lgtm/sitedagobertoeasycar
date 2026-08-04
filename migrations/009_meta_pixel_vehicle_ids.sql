CREATE SEQUENCE IF NOT EXISTS vehicle_catalog_item_seq START WITH 1;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS catalog_item_id text;

SELECT setval(
  'vehicle_catalog_item_seq',
  GREATEST(
    COALESCE((SELECT max(substring(catalog_item_id FROM 4)::bigint) FROM vehicles WHERE catalog_item_id ~ '^EC-[0-9]+$'), 0) + 1,
    1
  ),
  false
);

UPDATE vehicles
   SET catalog_item_id = 'EC-' || lpad(nextval('vehicle_catalog_item_seq')::text, 6, '0')
 WHERE catalog_item_id IS NULL OR catalog_item_id = '';

ALTER TABLE vehicles
  ALTER COLUMN catalog_item_id SET DEFAULT ('EC-' || lpad(nextval('vehicle_catalog_item_seq')::text, 6, '0')),
  ALTER COLUMN catalog_item_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_catalog_item_id_uidx
  ON vehicles(catalog_item_id);

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_catalog_item_id_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_catalog_item_id_check
  CHECK (catalog_item_id ~ '^EC-[0-9]{6,}$');
