-- Banners da home na identidade Auto Drive Veiculos.
-- As artes ficam versionadas em public/banners/ad-*.jpg, entao basta a
-- linha no banco apontar para o caminho. Isso evita depender do upload
-- pelo painel, que nao funciona na Vercel (sistema de arquivos efemero).

-- O banner padrao antigo apontava para /brand/hero-car.jpg, arquivo que
-- nao existe no repositorio. Se ainda houver alguma linha dessas, sai.
DELETE FROM banners WHERE image_url = '/brand/hero-car.jpg';

-- Cada insercao e guardada por NOT EXISTS para a migration poder ser
-- reaplicada sem duplicar banner.
INSERT INTO banners (title, image_url, link_url, link_target, sort_order, active)
SELECT 'Vários modelos para todos os gostos', '/banners/ad-01-parceiros.jpg', '/veiculos', '_self', 1, true
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/ad-01-parceiros.jpg');

INSERT INTO banners (title, image_url, link_url, link_target, sort_order, active)
SELECT 'Garantia de 90 dias e laudo cautelar', '/banners/ad-02-garantia.jpg', '/veiculos', '_self', 2, true
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/ad-02-garantia.jpg');

INSERT INTO banners (title, image_url, link_url, link_target, sort_order, active)
SELECT 'Negociação fácil e rápida', '/banners/ad-03-negociacao.jpg', 'https://wa.me/5511934718276', '_blank', 3, true
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/ad-03-negociacao.jpg');

INSERT INTO banners (title, image_url, link_url, link_target, sort_order, active)
SELECT 'Compre de particular com segurança', '/banners/ad-04-particulares.jpg', '/veiculos', '_self', 4, true
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/ad-04-particulares.jpg');

-- Rotacao do carrossel: 6 segundos da tempo de ler o titulo.
INSERT INTO site_settings (key, value) VALUES ('banner_interval_seconds', '6')
ON CONFLICT (key) DO UPDATE SET value = '6', updated_at = now();
