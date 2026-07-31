# Relatório de validação

Data final da validação: 31/07/2026, UTC-3.

## Build e qualidade

| Validação | Resultado |
|---|---|
| `pnpm lint` | aprovado, código 0 |
| `pnpm typecheck` | aprovado, código 0 |
| testes Node | 2 aprovados, 0 falhas |
| `pnpm build` | aprovado, 17 páginas/rotas geradas |
| serviço Windows | `RUNNING`, automático |
| `/api/health` direto | HTTP 200, aplicação e banco `ok` |
| `/api/health` via IIS | HTTP 200 pelos dois hosts e pelo IP público com Host header |
| PostgreSQL | `RUNNING`, automático, somente `127.0.0.1:5432` |

## Testes de segurança e função

- Endpoint de upload sem sessão: HTTP 401.
- Nome de upload inválido: HTTP 404.
- Login administrativo com a credencial protegida: HTTP 303.
- Primeiro acesso ao painel: HTTP 307 obrigatório para `/admin/trocar-senha`.
- Tela de troca de senha autenticada: HTTP 200.
- Upload E2E autenticado: HTTP 201; download: HTTP 200; arquivo de prova removido com validação de caminho.
- Cookie não foi exibido ou persistido nos relatórios.
- Node escuta somente `127.0.0.1:3100`; PostgreSQL somente `127.0.0.1:5432`.

## Responsividade

A Home foi executada no Microsoft Edge pelo Chrome DevTools Protocol, sem dependências adicionais. O teste mediu viewport, `documentElement.scrollWidth`, `body.scrollWidth` e elementos fora da tela, além de gerar screenshot.

| Largura | Scroll horizontal | Elementos fora do viewport |
|---:|---|---:|
| 320 | não | 0 |
| 360 | não | 0 |
| 375 | não | 0 |
| 390 | não | 0 |
| 412 | não | 0 |
| 768 | não | 0 |
| 1024 | não | 0 |
| 1366 | não | 0 |
| 1440 | não | 0 |
| 1920 | não | 0 |

Evidências: `validation\screenshots\home-<largura>.png` e `validation\screenshots\responsive-audit.json`.

## Backup e restauração

- Primeiro backup: `C:\Backups\DagobertoEasycar\daily\DagobertoEasycar_20260730_204548`.
- Dump custom PostgreSQL: 14.123 bytes, SHA-256 `E5CCD79DDC5C215E9F94395133138FB99F67F88F7E5BD513DED2991730A85646`.
- Restauração isolada executada em `dagoberto_easycar_restore_test`.
- Resultado restaurado: 6 tabelas públicas, 1 migration e 1 usuário.
- O banco de teste foi removido após a validação.
- Backup disparado pelo serviço de monitoramento: `C:\Backups\DagobertoEasycar\daily\DagobertoEasycar_20260731_123432`.
- O novo dump possui 14.247 bytes, SHA-256 `CF62C526803B2A2E21ADEECBCBDD49A68116D0C2E10421A1DAA30481ADC34CD5`, igual ao manifesto, e catálogo custom legível pelo `pg_restore` com 35 entradas.
- A restauração isolada do novo dump não foi repetida porque a conta da aplicação, corretamente, não possui `CREATEDB` e a política de segurança impediu procurar credenciais administrativas. A recuperação completa permanece comprovada pelo primeiro dump gerado pelo mesmo script.
- Retenção limitada às 7 pastas diárias mais recentes, com verificação de caminho antes de exclusão.

## Automação operacional

- `DagobertoEasycarMonitor`: serviço Windows automático via NSSM, executado como a conta virtual exclusiva `NT SERVICE\DagobertoEasycarMonitor`.
- Healthcheck direto e via IIS a cada 5 minutos, com log restrito em `C:\Logs\DagobertoEasycar\monitor\healthcheck.log`.
- Backup diário entre 02:30 e 02:34, disparado pelo mesmo serviço; teste manual do fluxo registrou `OK monitor exit=0` e consumiu corretamente o marcador.
- ACL mínima da conta virtual: leitura de `scripts`, `.env.production` e uploads; modificação somente em `C:\Logs\DagobertoEasycar\monitor` e `C:\Backups\DagobertoEasycar\daily`. A raiz da aplicação e o `.git` não foram liberados.
- As tarefas equivalentes do Agendador de Tarefas foram removidas após falharem ao iniciar processos nesta VM; não fazem parte da arquitetura ativa.
- Recuperação do serviço: reinícios após 5 s, 15 s e 60 s.
- Backups de build para rollback em `C:\Backups\DagobertoEasycar\releases`.
- Deploy/rollback aguardam até 180 segundos, necessário por causa da baixa memória da VM.

## Resultado externo

Os registros A de `dagobertoeasycar.com.br` e `www.dagobertoeasycar.com.br` resolvem para `148.224.63.68`. O certificado público Let's Encrypt contém os dois nomes e é válido até 29/10/2026. HTTP nos dois hosts e HTTPS sem `www` retornam 301 para `https://www.dagobertoeasycar.com.br/`.

O domínio oficial foi aberto no navegador externo com certificado válido, título e conteúdo corretos. As rotas `/`, `/api/health`, `/robots.txt`, `/sitemap.xml` e `/admin/login` responderam em HTTPS; o healthcheck público retornou aplicação e banco `ok` com a versão implantada.
