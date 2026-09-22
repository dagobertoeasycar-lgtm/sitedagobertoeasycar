-- 021_dominio_appautodrive.sql
--
-- O domínio oficial passou a ser www.appautodrive.com.br. Atualiza a imagem
-- padrão do catálogo da Meta que ainda apontava para o domínio antigo.

UPDATE site_settings
SET value = replace(value, 'https://www.dagobertoeasycar.com.br/', 'https://www.appautodrive.com.br/')
WHERE key = 'meta_default_image_url'
  AND value LIKE 'https://www.dagobertoeasycar.com.br/%';
