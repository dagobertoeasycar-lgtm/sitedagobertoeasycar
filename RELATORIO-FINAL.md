# Relatório final de implantação

## Estado entregue

A aplicação Dagoberto Easycar está instalada e operacional na VM em `C:\Sites\DagobertoEasycar`, com banco PostgreSQL persistente, serviços Windows, reverse proxy IIS, painel administrativo, uploads, backups, restore testado, monitoramento e HTTPS público. O domínio oficial foi aberto e validado externamente em `https://www.dagobertoeasycar.com.br/`.

Arquitetura ativa:

`Internet -> IIS 80/443 por hostname -> ARR -> 127.0.0.1:3100 -> Next.js -> 127.0.0.1:5432 -> PostgreSQL`

O sistema UPT existente e seus bindings foram preservados.

## Publicação, DNS e TLS

- DNS: `dagobertoeasycar.com.br` e `www.dagobertoeasycar.com.br` resolvem para `148.224.63.68`.
- Certificado: Let's Encrypt, SAN para os dois hosts, válido até 29/10/2026.
- Renovação: win-acme 2.2.9, renovação registrada e tarefa global saudável; próxima janela informada em 24/09/2026.
- Bindings: HTTP e HTTPS exclusivos por hostname no site IIS `Dagoberto Easycar`.
- Redirecionamentos aprovados: HTTP em ambos os hosts e HTTPS sem `www` terminam em `https://www.dagobertoeasycar.com.br/`.
- Rotas públicas aprovadas: Home, `/api/health`, `/robots.txt`, `/sitemap.xml` e `/admin/login`.
- Backup da configuração anterior do IIS: `Before-DagobertoEasycar-SSL-20260731-125637`.

## Acesso administrativo

- URL futura: `https://www.dagobertoeasycar.com.br/admin`
- E-mail: `meucomercioonline5@gmail.com`
- Senha temporária: armazenada somente em `C:\Sites\DagobertoEasycar\secrets\initial-admin.txt`.
- O primeiro login é obrigado a trocar a senha por uma senha forte.

Não copie a senha para chamados, e-mail ou logs. Após a troca e confirmação, o arquivo inicial pode ser arquivado em cofre ou removido pelo administrador.

## Operação

- Saúde direta: `http://127.0.0.1:3100/api/health`
- Logs: `C:\Logs\DagobertoEasycar`
- Logs restritos do monitor: `C:\Logs\DagobertoEasycar\monitor`
- Backups: `C:\Backups\DagobertoEasycar`
- Uploads: `C:\Sites\DagobertoEasycar\data\uploads`
- Serviço web: `DagobertoEasycarApp`
- Serviço de monitoramento e backup: `DagobertoEasycarMonitor`, automático, sob a conta virtual exclusiva `NT SERVICE\DagobertoEasycarMonitor`
- Serviço de banco: `postgresql-x64-17`
- IIS: site `Dagoberto Easycar`, pool `DagobertoEasycarPool`

O monitor verifica a aplicação diretamente e pelo IIS a cada 5 minutos e dispara o backup diário às 02:30. Sua conta possui somente as ACLs necessárias para ler scripts, ambiente e uploads e para gravar no diretório restrito de logs e na pasta diária de backup. O fluxo automatizado foi comprovado pelo backup `DagobertoEasycar_20260731_123432`, com saída `OK monitor exit=0` e hash conferido contra o manifesto. As tentativas equivalentes pelo Agendador de Tarefas foram removidas porque o subsistema não iniciava processos corretamente nesta VM.

O deploy usa `scripts\deploy.ps1`; rollback por commit usa `scripts\rollback.ps1 -Commit <sha>`. Ambos devem ser executados em PowerShell elevado com `-ExecutionPolicy Bypass -File`, pois a política global da máquina bloqueia scripts não assinados e não foi enfraquecida.

## Pendências não bloqueantes

1. GitHub: executar novamente `gh auth login` para uma conta com escrita em `dagobertoeasycar-lgtm/sitedagobertoeasycar` e então publicar os commits locais. O token atual de `upt-commits` é inválido.
2. SMTP: fornecer host, porta, usuário, senha e remetente caso se deseje notificação de lead por e-mail.
3. Integração JSON: fornecer URL/arquivo, autenticação e formato real para ativar a sincronização a cada minuto.

## Riscos que exigem decisão do proprietário

- RDP 3389 está exposto e em uso. Restringir somente após confirmar IPs de administração ou VPN.
- SQL Server 1433 está exposto. Confirmar clientes do UPT antes de limitar firewall.
- A VM tem apenas 4 GB de RAM e já hospeda outros sistemas; recomenda-se elevar para ao menos 8 GB, preferencialmente 12–16 GB, antes de crescimento de tráfego ou builds frequentes.
- Windows 10 Pro não é um sistema operacional de servidor. Para operação de longo prazo, planejar migração para Windows Server suportado ou Linux LTS.

## Critério de produção

Backend, banco, proxy HTTP/HTTPS, DNS, certificado público, renovação, redirecionamentos, persistência, backup, restore, monitoramento, painel, upload, responsividade e segurança básica estão aprovados. O domínio canônico está online em `https://www.dagobertoeasycar.com.br/`. GitHub, SMTP e a fonte JSON continuam pendentes por credenciais ou dados externos, sem impedir a operação pública atual.

## Matriz obrigatória de entrega

1. **Sistema operacional:** Windows 10 Pro 25H2, build 26200.8655; a VM não executa Windows Server.
2. **Recursos da VM:** Intel Xeon E5-2695 v2, 3 processadores lógicos, aproximadamente 4 GB de RAM e disco C: de 257 GB, com cerca de 169 GB livres na coleta inicial.
3. **IP público:** `148.224.63.68`, confirmado na interface e no DNS público.
4. **IP privado:** não há endereço privado separado documentado; o IP público está configurado diretamente na interface da VM.
5. **Pastas criadas:** raiz em `C:\Sites\DagobertoEasycar`, infraestrutura, dados, uploads, scripts, logs em `C:\Logs\DagobertoEasycar` e backups em `C:\Backups\DagobertoEasycar`.
6. **Repositório:** `https://github.com/dagobertoeasycar-lgtm/sitedagobertoeasycar.git`, clonado diretamente na raiz correta.
7. **Branch:** `main`.
8. **Commits:** implantação `dd48911`, endurecimento `c3971c0`, monitor HTTPS `d829bab` e documentação HTTPS `86237db`; o SHA do commit que contém esta matriz é informado no handoff final.
9. **Componentes:** Node.js, pnpm, Git, GitHub CLI, PostgreSQL 17.10, NSSM, IIS, ARR, URL Rewrite e win-acme.
10. **Arquitetura:** IIS 80/443 por hostname → Next.js em `127.0.0.1:3100` → PostgreSQL em `127.0.0.1:5432`.
11. **Motivo da escolha:** preserva o IIS/UPT existente, evita conflito de 80/443 e consome menos memória que Docker Desktop nesta VM de 4 GB.
12. **Aplicação:** Next.js 16.2.12, React 19.2.8 e TypeScript estrito, em build de produção standalone.
13. **Banco:** PostgreSQL nativo, banco exclusivo `dagoberto_easycar`, SCRAM-SHA-256 e acesso somente local.
14. **Usuário do banco:** `dagoberto_app`, sem privilégio administrativo e sem senha exposta.
15. **Reverse proxy:** site IIS `Dagoberto Easycar`, pool `DagobertoEasycarPool`, ARR e URL Rewrite.
16. **Serviços:** `DagobertoEasycarApp`, `DagobertoEasycarMonitor`, `postgresql-x64-17` e `W3SVC`, automáticos e validados como ativos.
17. **Portas:** 80/443 públicas por IIS; 3100 e 5432 somente em loopback. RDP 3389 e SQL Server 1433 preexistentes foram preservados por dependência operacional.
18. **Firewall:** HTTP/HTTPS permitidos; nenhuma regra pública foi criada para Next.js ou PostgreSQL.
19. **DNS:** registros A de raiz e `www` apontam para `148.224.63.68`.
20. **SSL:** certificado público Let's Encrypt para os dois hosts, válido até 29/10/2026.
21. **Renovação:** win-acme registrado, tarefa `win-acme renew` saudável e próxima execução agendada.
22. **Redirecionamentos:** HTTP raiz/www e HTTPS raiz terminam em `https://www.dagobertoeasycar.com.br/` com 301.
23. **Lint:** aprovado, código 0.
24. **Typecheck:** aprovado, código 0.
25. **Testes:** 2 aprovados, 0 falhas, além dos testes E2E administrativos e de upload.
26. **Build:** aprovado, 17 páginas/rotas geradas.
27. **Migrations:** aplicadas com sucesso; o banco restaurado confirmou 1 migration.
28. **Healthcheck:** público e local retornam aplicação e banco `ok`, ambiente `production` e versão implantada.
29. **Restart:** aplicação, monitor e banco recuperaram o estado `Running`; a persistência foi verificada após reinício controlado dos serviços.
30. **Persistência:** banco e uploads ficam fora do build descartável e sobreviveram ao restart testado. A VM inteira não foi reiniciada para não interromper os sistemas UPT ativos.
31. **Backup:** fluxo diário às 02:30 executado pela conta virtual do monitor; dump automatizado, manifesto e SHA-256 conferidos.
32. **Restauração:** primeiro dump restaurado em banco isolado, com 6 tabelas, 1 migration e 1 usuário; banco temporário removido.
33. **Catálogo:** rotas de estoque e detalhes estão funcionais; o estoque público aguarda anúncios reais pelo painel. O dump automatizado possui catálogo `pg_restore` legível com 35 entradas.
34. **Painel:** login, troca obrigatória de senha inicial, dashboard e operações administrativas validados.
35. **Uploads:** autorização, tipo real, limite, persistência, download e limpeza do arquivo de prova validados.
36. **Integração JSON:** implementação idempotente pronta, mas sincronização recorrente não ativada porque faltam fonte, autenticação e formato reais.
37. **URL pública:** `https://www.dagobertoeasycar.com.br/`.
38. **URL do painel:** `https://www.dagobertoeasycar.com.br/admin`.
39. **Credenciais ainda necessárias:** nova autenticação GitHub com escrita; SMTP se desejado; credencial e endpoint da fonte JSON. Nenhum valor secreto é incluído neste relatório.
40. **Pendências reais:** push ao GitHub, SMTP e fonte JSON; decisão do proprietário sobre restrição de RDP/SQL Server e aumento de RAM/migração de sistema operacional.
41. **Ações exatas:** executar `gh auth login` com conta autorizada e publicar `main`; fornecer parâmetros SMTP; fornecer URL/arquivo, autenticação e amostra JSON; informar IPs administrativos/VPN antes de restringir 3389; confirmar consumidores UPT antes de restringir 1433; planejar 8 GB ou mais de RAM e sistema operacional de servidor suportado.
