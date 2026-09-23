-- 024_crm_leads.sql
--
-- CRM de leads: quadro por etapas, agendamento, etiquetas, motivo de perda e
-- histórico do atendimento. Tudo aditivo.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS leads_status_updated_idx ON leads(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS leads_scheduled_idx ON leads(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Linha do tempo do lead: anotações, mudanças de etapa e edições.
CREATE TABLE IF NOT EXISTS lead_activities (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('note', 'stage', 'edit', 'schedule', 'vehicle', 'tags')),
  text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities(lead_id, created_at DESC);

-- A anotação única que existia vira a primeira entrada do histórico.
INSERT INTO lead_activities(lead_id, created_at, user_id, type, text)
SELECT id, coalesce(updated_at, created_at), assigned_to, 'note', notes
FROM leads
WHERE coalesce(trim(notes), '') <> ''
  AND NOT EXISTS (SELECT 1 FROM lead_activities a WHERE a.lead_id = leads.id AND a.type = 'note');
