create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  source_id text,
  external_id text,
  slug text not null unique,
  title text not null,
  brand text not null,
  model text not null,
  version text not null default '',
  year_make integer not null,
  year_model integer not null,
  price_cents integer not null check (price_cents >= 0),
  mileage integer not null default 0 check (mileage >= 0),
  fuel text not null,
  transmission text not null,
  body_type text not null default '',
  city text not null default 'Osasco/SP',
  description text not null default '',
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'sold')),
  featured boolean not null default false,
  promotion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (source_id, external_id)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'financing', 'sell_car')),
  name text not null,
  email text,
  phone text not null,
  vehicle_id uuid references vehicles(id) on delete set null,
  message text not null default '',
  consent_at timestamptz not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id bigserial primary key,
  source_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed integer not null default 0,
  created integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  errors integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create index if not exists vehicles_public_idx on vehicles(status, featured, created_at desc);
create index if not exists leads_status_idx on leads(status, created_at desc);
