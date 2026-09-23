-- 023_central_de_controle.sql
--
-- Contador de visitas do site e histórico de e-mails enviados.
-- Tudo aditivo: nenhuma tabela ou coluna existente muda.

-- Eventos anônimos do site (visualização de página e cliques de contato).
-- Não guarda IP: só cidade/estado aproximados vindos do cabeçalho da Vercel.
CREATE TABLE IF NOT EXISTS site_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT NOT NULL CHECK (event IN ('pageview', 'whatsapp_click', 'form_open')),
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  is_new_visitor BOOLEAN NOT NULL DEFAULT false,
  path TEXT NOT NULL,
  section TEXT NOT NULL,
  vehicle_slug TEXT,
  search_query TEXT,
  referrer_host TEXT,
  source TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  device TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS site_events_created_idx ON site_events(created_at DESC);
CREATE INDEX IF NOT EXISTS site_events_event_created_idx ON site_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS site_events_vehicle_idx ON site_events(vehicle_slug, created_at DESC) WHERE vehicle_slug IS NOT NULL;

-- Cada e-mail disparado (aviso interno e confirmação ao cliente), com o
-- resultado. É o que o painel mostra em Configurações → E-mails.
CREATE TABLE IF NOT EXISTS email_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lead_internal', 'lead_customer', 'test')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT
);
CREATE INDEX IF NOT EXISTS email_log_created_idx ON email_log(created_at DESC);
