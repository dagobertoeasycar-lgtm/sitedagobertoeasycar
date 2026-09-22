-- 022_painel_novo.sql
--
-- Suporte aos módulos do painel novo. Tudo é aditivo: colunas novas com
-- valor padrão, nenhuma coluna existente muda de sentido.

-- SEO por anúncio. A sincronização dos parceiros não escreve nestas colunas,
-- então o que for ajustado no painel permanece.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Atendimento de leads e financiamentos: responsável, anotações e data da
-- última movimentação.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS leads_assigned_idx ON leads(assigned_to, status);

-- Usuários e permissões: nome de exibição, último acesso e os perfis do
-- protótipo (administrador, editor de anúncios, marketing, comercial).
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'editor', 'marketing', 'comercial'));

-- Auditoria: IP e resultado da ação, como pede o protótipo.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip TEXT;
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
