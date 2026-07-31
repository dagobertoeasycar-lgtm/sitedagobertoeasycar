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
