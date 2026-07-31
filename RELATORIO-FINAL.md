# Relatório final de implantação

## Estado entregue

A aplicação Dagoberto Easycar está instalada e operacional na VM em `C:\Sites\DagobertoEasycar`, com banco PostgreSQL persistente, serviço Windows, reverse proxy IIS, painel administrativo, uploads, backups, restore testado e monitoramento. O serviço responde localmente e pelo IP público em HTTP quando o Host header correto é usado.

Arquitetura ativa:

`Internet -> IIS 80/443 por hostname -> ARR -> 127.0.0.1:3100 -> Next.js -> 127.0.0.1:5432 -> PostgreSQL`

O sistema UPT existente e seus bindings foram preservados.

## Acesso administrativo

- URL futura: `https://www.dagobertoeasycar.com.br/admin`
- E-mail: `meucomercioonline5@gmail.com`
- Senha temporária: armazenada somente em `C:\Sites\DagobertoEasycar\secrets\initial-admin.txt`.
- O primeiro login é obrigado a trocar a senha por uma senha forte.

Não copie a senha para chamados, e-mail ou logs. Após a troca e confirmação, o arquivo inicial pode ser arquivado em cofre ou removido pelo administrador.

## Operação

- Saúde direta: `http://127.0.0.1:3100/api/health`
- Logs: `C:\Logs\DagobertoEasycar`
- Backups: `C:\Backups\DagobertoEasycar`
- Uploads: `C:\Sites\DagobertoEasycar\data\uploads`
- Serviço web: `DagobertoEasycarApp`
- Serviço de banco: `postgresql-x64-17`
- IIS: site `Dagoberto Easycar`, pool `DagobertoEasycarPool`

O deploy usa `scripts\deploy.ps1`; rollback por commit usa `scripts\rollback.ps1 -Commit <sha>`. Ambos devem ser executados em PowerShell elevado com `-ExecutionPolicy Bypass -File`, pois a política global da máquina bloqueia scripts não assinados e não foi enfraquecida.

## Pendências externas obrigatórias

1. DNS: criar/ajustar registros A de `@` e `www` para `148.224.63.68`, preservando MX, SPF, DKIM, DMARC e demais registros de e-mail.
2. SSL: após a propagação DNS, emitir certificado público para domínio raiz e `www`, adicionar bindings 443 no IIS e substituir o proxy pré-DNS pelo `C:\Sites\DagobertoEasycar\infra\web.config` final.
3. GitHub: executar novamente `gh auth login` para uma conta com escrita em `dagobertoeasycar-lgtm/sitedagobertoeasycar` e então publicar o commit local. O token atual de `upt-commits` é inválido.
4. SMTP: fornecer host, porta, usuário, senha e remetente caso se deseje notificação de lead por e-mail.
5. Integração JSON: fornecer URL/arquivo, autenticação e formato real para ativar a tarefa de sincronização a cada minuto.

## Riscos que exigem decisão do proprietário

- RDP 3389 está exposto e em uso. Restringir somente após confirmar IPs de administração ou VPN.
- SQL Server 1433 está exposto. Confirmar clientes do UPT antes de limitar firewall.
- A VM tem apenas 4 GB de RAM e já hospeda outros sistemas; recomenda-se elevar para ao menos 8 GB, preferencialmente 12–16 GB, antes de crescimento de tráfego ou builds frequentes.
- Windows 10 Pro não é um sistema operacional de servidor. Para operação de longo prazo, planejar migração para Windows Server suportado ou Linux LTS.

## Critério de produção

Backend, banco, proxy HTTP, persistência, backup, restore, monitoramento, painel, upload, responsividade e segurança básica estão aprovados. A publicação pública canônica com HTTPS permanece bloqueada exclusivamente por DNS/certificado. Portanto o estado correto é: servidor pronto para ativação DNS, mas domínio HTTPS ainda não concluído.
