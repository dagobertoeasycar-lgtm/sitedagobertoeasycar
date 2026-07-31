-- Campos extras para sincronização com EasyCar estoque
alter table vehicles add column if not exists images jsonb not null default '[]'::jsonb;
alter table vehicles add column if not exists color text not null default '';
alter table vehicles add column if not exists doors integer not null default 4;
alter table vehicles add column if not exists options jsonb not null default '[]'::jsonb;
alter table vehicles add column if not exists old_price_cents integer;
alter table vehicles add column if not exists store text not null default '';

-- Tabela de configuração do sync
create table if not exists sync_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Valores padrão
insert into sync_config(key, value) values
  ('easycar_enabled', 'true'),
  ('easycar_interval_minutes', '5')
on conflict (key) do nothing;
