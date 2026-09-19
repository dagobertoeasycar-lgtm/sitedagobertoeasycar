-- 020_tempo_sessao_admin.sql
--
-- Controle global da duracao das sessoes administrativas. Mantem as oito
-- horas usadas anteriormente como padrao para nao alterar a seguranca atual.

INSERT INTO site_settings(key, value) VALUES
  ('admin_session_timeout_enabled', 'true'),
  ('admin_session_timeout_minutes', '480')
ON CONFLICT (key) DO NOTHING;
