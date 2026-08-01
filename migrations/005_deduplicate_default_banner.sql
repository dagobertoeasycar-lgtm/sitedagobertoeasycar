DELETE FROM banners
WHERE image_url = '/brand/hero-car.jpg'
  AND link_url = '/veiculos'
  AND id <> (
    SELECT min(id)
    FROM banners
    WHERE image_url = '/brand/hero-car.jpg' AND link_url = '/veiculos'
  );

CREATE UNIQUE INDEX IF NOT EXISTS banners_default_hero_once
  ON banners (image_url, link_url)
  WHERE image_url = '/brand/hero-car.jpg' AND link_url = '/veiculos';
