-- Justo Car e Now Car passam a ser lidas pela API GraphQL da BNDV (Azure,
-- sem Cloudflare), que funciona da nuvem. O conector continua o mesmo
-- (bndv_next / bndv_html): com bndvCompanyId ele usa a API e, se ela falhar,
-- volta a ler o site como antes. Ids da BNDV: Justo Car 850, Now Car 766.
update partners
   set connector_config = coalesce(connector_config, '{}'::jsonb) || '{"bndvCompanyId":850}'::jsonb,
       updated_at = now()
 where sync_source_id = 'justocar';

update partners
   set connector_config = coalesce(connector_config, '{}'::jsonb) || '{"bndvCompanyId":766}'::jsonb,
       updated_at = now()
 where sync_source_id = 'nowcar';
