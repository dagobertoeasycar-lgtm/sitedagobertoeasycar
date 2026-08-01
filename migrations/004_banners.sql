CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '',
  link_target TEXT NOT NULL DEFAULT '_self',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the default banner only once, even when the migration is rerun.
INSERT INTO banners (title, image_url, link_url, sort_order, active)
SELECT 'Encontre seu veículo', '/brand/hero-car.jpg', '/veiculos', 0, true
WHERE NOT EXISTS (
  SELECT 1
  FROM banners
  WHERE image_url = '/brand/hero-car.jpg' AND link_url = '/veiculos'
);
