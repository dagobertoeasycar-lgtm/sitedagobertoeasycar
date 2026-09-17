-- 014_guiotti_estoque_completo.sql
--
-- O Guiotti estava importando somente carros: dos 19 veículos anunciados,
-- entravam 7 e ficavam de fora 12 motos. A orientação passou a ser subir o
-- estoque inteiro, então o filtro vira 'all'.
--
-- Efeito colateral a saber: moto também vai para o feed do catálogo da Meta,
-- porque o feed lê o mesmo estoque publicado. Para voltar a só carros, é o
-- seletor "O que importar" na tela de Parceiros — sem precisar de migration.

UPDATE partners
   SET connector_config = jsonb_set(
         coalesce(connector_config, '{}'::jsonb),
         '{vehicleFilter}',
         '"all"'::jsonb,
         true
       ),
       updated_at = now()
 WHERE sync_source_id = 'guiottimultimarcas';

-- Páginas suficientes para o estoque inteiro: a plataforma pagina de 12 em 12.
UPDATE partners
   SET connector_config = jsonb_set(connector_config, '{maxPages}', '12'::jsonb, true),
       updated_at = now()
 WHERE sync_source_id = 'guiottimultimarcas';
