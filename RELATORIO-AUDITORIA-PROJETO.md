# Relatório de auditoria do projeto

## Fonte e reconstrução

O repositório oficial não continha código-fonte além do README. O protótipo comercial disponível foi inspecionado apenas como referência visual e funcional. A aplicação de produção foi construída no diretório obrigatório `C:\Sites\DagobertoEasycar`, sem Vercel ou Netlify.

## Componentes implementados

- Next.js 16.2.12, React 19.2.8 e TypeScript estrito.
- PostgreSQL 17.10 com SCRAM-SHA-256, usuário de aplicação sem privilégios administrativos e migrations versionadas.
- Serviço Windows `DagobertoEasycarApp` via NSSM, inicialização automática atrasada, dependência do PostgreSQL, logs separados e recuperação automática.
- Serviço Windows `DagobertoEasycarMonitor` via NSSM para healthcheck a cada 5 minutos e backup diário às 02:30, sob conta virtual exclusiva e ACL mínima.
- Site público com Home, estoque, detalhe do veículo, sobre, financiamento, venda do carro, contato, privacidade e termos.
- SEO técnico: metadados, canonical, sitemap, robots e dados estruturados `AutoDealer`/`LocalBusiness`.
- Formulários comerciais persistidos em PostgreSQL com consentimento e validação de tamanho.
- Painel autenticado com cadastro de veículo, upload local validado por assinatura binária, publicação/pausa/venda, estoque, leads e trilha de auditoria.
- Senha temporária com troca obrigatória no primeiro acesso, scrypt, cookie HttpOnly/Secure/SameSite e sessão HMAC com expiração de 8 horas.
- Importação JSON idempotente por `source_id + external_id`, lock consultivo PostgreSQL e relatório de execução.
- Scripts de migrate, criação única do administrador, sincronização, backup, healthcheck, deploy e rollback.

## Banco de dados

Tabelas: `schema_migrations`, `users`, `vehicles`, `leads`, `audit_log` e `sync_runs`. Índices foram criados para estoque público e fila de leads. O PostgreSQL está limitado a 60 conexões, `shared_buffers=256MB` e grava logs diários em `C:\Logs\DagobertoEasycar\postgres`.

## Segurança e dados sensíveis

- `.env.production` e `C:\Sites\DagobertoEasycar\secrets` têm herança removida e ACL restrita.
- A credencial inicial não aparece em código, logs ou relatórios; está em `C:\Sites\DagobertoEasycar\secrets\initial-admin.txt`.
- Uploads aceitam somente JPEG, PNG, WebP ou AVIF de até 8 MB, verificam magic bytes, usam UUID aleatório e ficam em `C:\Sites\DagobertoEasycar\data\uploads`.
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy e Permissions Policy estão ativos.
- Healthcheck não revela credenciais nem detalhes internos do banco.
- A conta virtual do monitor não possui acesso à raiz completa nem ao `.git`; lê apenas scripts, `.env.production` e uploads e grava somente nos diretórios dedicados de monitoramento e backup diário.

## Itens condicionais não ativados

- Sincronização JSON automática: script pronto, mas tarefa não registrada porque não foram fornecidos endpoint e credenciais da fonte.
- SMTP: não configurado por ausência de servidor/usuário/senha; os leads permanecem persistidos no banco.
- MFA: o sistema não tinha provedor MFA disponível. A proteção aplicada é troca obrigatória, scrypt, sessão curta e auditoria.
- Exclusão definitiva de veículo: não exposta no painel; o fluxo operacional usa rascunho, publicado, pausado e vendido para preservar histórico.

## Integração IIS

O site `Dagoberto Easycar` possui bindings HTTP específicos para `dagobertoeasycar.com.br` e `www.dagobertoeasycar.com.br`. O proxy foi corrigido de 3000 para 3100. Enquanto DNS/SSL estão pendentes, usa `web.config.pre-dns` sem redirecionamento quebrado. O `web.config` final com HTTPS e canonical está pronto para ativação após o certificado.
