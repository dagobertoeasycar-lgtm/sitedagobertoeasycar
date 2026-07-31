# Relatório de diagnóstico inicial

Data da coleta: 30/07/2026, fuso America/Sao_Paulo (UTC-3).

## Resumo executivo

A máquina recebida não é Windows Server: executa Windows 10 Pro 25H2, build 26200.8655, hostname `TESTE1-61S2PK3K`. O endereço `148.224.63.68` está configurado diretamente na interface e responde como IP público do servidor. A VM possui Intel Xeon E5-2695 v2, 3 processadores lógicos, aproximadamente 4 GB de RAM e disco C: de 257 GB, com cerca de 169 GB livres na coleta inicial. A memória livre inicial estava abaixo de 400 MB, o que exige limitar concorrência e evitar Docker Desktop.

## Serviços preexistentes preservados

- IIS com ARR e URL Rewrite já instalados.
- Site `UPT-ClanSystem` ativo em 80/443 para `universopt.com.br`, `www`, `patch`, `monitor` e `admin`.
- `Default Web Site` em `127.0.0.1:8081`.
- Aplicações Node preexistentes em `127.0.0.1:3000` e `127.0.0.1:3001`.
- SQL Server `MSSQLSERVER` ouvindo em 1433.
- RDP ouvindo em 3389, com sessões externas estabelecidas durante a auditoria.
- Microsoft Defender ativo.

Nenhum reboot foi executado. O site UPT e seus bindings não foram alterados.

## Estado inicial da aplicação Dagoberto

- Docker, WSL, PostgreSQL e NSSM não estavam instalados.
- Node.js 24.18.0, Git 2.55 e GitHub CLI 2.96 já estavam presentes.
- O repositório público oficial continha somente um `README.md` de 76 bytes, um commit (`c66a61c0868f820703573a13f9c01de5b185ba7f`) e a branch `main`; não havia aplicação implantável.
- O site IIS `Dagoberto Easycar` já existia, porém apontava incorretamente para `127.0.0.1:3000` e redirecionava para HTTPS antes de existir certificado.
- A autenticação do GitHub CLI para `upt-commits` estava inválida. Leitura pública via Git HTTPS funcionou.

## Riscos encontrados

1. RDP 3389 exposto e em uso. Não foi restringido sem confirmar IPs administrativos, para evitar bloqueio remoto do operador.
2. SQL Server 1433 exposto externamente. A dependência do sistema UPT deve ser confirmada antes de restringir.
3. Pressão severa de memória. Builds Next.js levam de dois a quatro minutos e o início do serviço pode levar dezenas de segundos.
4. DNS do domínio Dagoberto ainda não resolve registros A; emissão de certificado público é impossível até a correção da zona.
5. Credencial do GitHub CLI expirada/inválida impede publicar os commits locais.

## Decisão de arquitetura

Foi adotado Next.js nativo como serviço Windows em `127.0.0.1:3100`, PostgreSQL nativo em `127.0.0.1:5432` e IIS ARR como reverse proxy por host. Essa opção preserva o IIS que já ocupa 80/443, evita conflito com Caddy e reduz consumo de RAM comparado a Docker Desktop. As portas 3100 e 5432 não são publicadas externamente.

Antes da alteração do IIS foi criado o backup `Before-DagobertoEasycar-20260730-204039`.
