# Dagoberto Easycar Veículos

Aplicação Next.js de produção para catálogo automotivo, captação de leads e administração do estoque da Dagoberto Easycar.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e preencha as variáveis.
2. Execute `pnpm install`.
3. Execute `pnpm db:migrate`.
4. Crie o primeiro administrador com `pnpm admin:create`.
5. Execute `pnpm dev`.

O ambiente de produção usa PostgreSQL local, aplicação vinculada somente a `127.0.0.1:3100` e IIS/ARR como proxy reverso por hostname.
