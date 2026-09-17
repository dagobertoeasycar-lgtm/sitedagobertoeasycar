# Relatório — Central de estoque multiorigem

Data: 17/09/2026 · Repositório: `D:\sitedagobertoeasycar\_envio_github\repo`

---

## 1. Correções de rota antes de programar

Três premissas do roteiro não batiam com a realidade do código. Registro porque mudaram tudo.

**A extensão não tem sistema de estoque.** `D:\Sistema de avisos\Robo\autoconf-extension` é um importador de **negociações** AutoConf → AutoDrive para cálculo de comissão, mais Campanha Feirão (WhatsApp), check-list Jotform e anexo de contratos. Busca por `parceiro`, `stock`, `inventor`: zero ocorrências. Não havia o que "transformar" ali.

**O código do site estava em subpasta.** A raiz de `D:\sitedagobertoeasycar` é um scaffold de julho com `db/schema.ts` vazio e veículos fictícios. O projeto real é `_envio_github\repo` — Next.js 16, Postgres com migrations numeradas, `src/app`.

**Metade do roteiro já existia.** O commit `8571919 feat: adiciona origem dos veículos` (15/09) já entregou tabela `partners`, `private_vehicle_owners`, `vehicles.origin_type`, tags públicas, filtro de origem e rastreio de lead. Foi preservado integralmente.

---

## 2. Arquivos analisados

`manifest.json`, `README.md`, `popup.html` (extensão) · `package.json`, `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/vehicles.ts`, `src/lib/vehicle-origin.ts`, `src/components/AdminLayout.tsx`, `src/components/VehicleStatusForm.tsx`, `src/app/admin/page.tsx`, `src/app/admin/veiculos/page.tsx`, `src/app/admin/leads/page.tsx`, `src/app/admin/atacado/page.tsx`, `src/app/admin/configuracoes/page.tsx`, `src/app/api/admin/vehicles/route.ts`, `src/app/api/admin/vehicles/[id]/route.ts`, `scripts/sync-easycar.mjs`, `scripts/migrate.mjs`, `migrations/001_initial.sql`, `migrations/011_vehicle_origin_and_lead_tracking.sql`, `tests/vehicle-origin.test.mjs`, `.github/workflows/sync-estoque.yml`, `src/app/globals.css`.

## 3. Arquivos criados

| Arquivo | Motivo |
|---|---|
| `migrations/012_pricing_internal_code_availability.sql` | Preço de origem, margem, ID interno, disponibilidade, `app_settings`, campos do parceiro |
| `src/lib/pricing.ts` | Regra comercial de preço, pura e testável |
| `src/lib/settings.ts` | Leitura/gravação de `app_settings` com queda para o padrão |
| `src/lib/partners.ts` | Consultas e validação de parceiros |
| `src/components/PartnersAdmin.tsx` | Tela de gestão de parceiros |
| `src/components/PricingRuleForm.tsx` | Formulário da regra de preço com simulação ao vivo |
| `src/app/admin/parceiros/page.tsx` | Rota do CRUD de parceiros |
| `src/app/admin/configuracoes/precificacao/page.tsx` | Rota da regra de preço |
| `src/app/api/admin/partners/route.ts` | Criar parceiro |
| `src/app/api/admin/partners/[id]/route.ts` | Editar, ativar/desativar, excluir |
| `src/app/api/admin/pricing-rule/route.ts` | Ler e salvar regra de preço e carência |
| `tests/pricing.test.mjs` | 9 testes da regra de preço |

## 4. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `scripts/sync-easycar.mjs` | Preço de origem separado do publicado, histórico de alteração, carência antes de inativar, contadores por parceiro |
| `src/app/admin/page.tsx` | Bloco "Estoque por origem" com 7 indicadores |
| `src/app/admin/leads/page.tsx` | Coluna "Veículo e origem" com parceiro e margem — uso interno |
| `src/components/AdminLayout.tsx` | Item "Parceiros"; o antigo `/admin/atacado` virou "Leads de Parceiros", que é o que ele sempre foi |
| `src/app/admin/configuracoes/page.tsx` | Atalhos para regra de preço e parceiros |
| `src/app/globals.css` | 6 classes novas de apoio, sem tocar em cor ou identidade |

---

## 5. Precificação

O ponto que exigiu mais cuidado. `vehicles.price_cents` **continua sendo o preço publicado** — é o que todo o site, o feed da Meta e o catálogo já leem. Nada que existia precisou mudar.

O que entrou foi ao lado:

- `origin_price_cents` — preço do parceiro, nunca sobrescrito
- `price_markup_cents` — acréscimo aplicado
- `price_markup_mode` — `auto` (segue a regra), `manual` (valor do veículo), `none` (sem acréscimo)

Exemplo real com a regra padrão:

```
preço do parceiro   R$ 67.900   → origin_price_cents = 6790000
acréscimo           R$  2.000   → price_markup_cents =  200000
preço publicado     R$ 69.900   → price_cents        = 6990000
```

**O acréscimo é determinístico.** Sortear um valor entre R$ 2.000 e R$ 3.000 faria o preço anunciado mudar sozinho a cada 15 minutos, junto com o feed da Meta e o catálogo do WhatsApp. Em vez disso parte do piso e arredonda o preço final para múltiplo de R$ 100, desde que o acréscimo continue dentro da faixa. Mesma entrada, mesmo preço, sempre.

Configurável em **Configurações → Regra de preço**: modo faixa, fixo ou nenhum; mínimo, máximo, arredondamento; e quais origens recebem acréscimo (estoque próprio vem desmarcado).

## 6. Identificação interna

Sequências separadas por origem, atribuídas por trigger no INSERT e imutáveis depois:

```
AD-PRO-000001   estoque próprio
AD-PAR-000001   loja parceira
AD-PRI-000001   venda particular
```

O estoque existente foi numerado no backfill, por ordem de cadastro.

## 7. Disponibilidade com carência

Antes, veículo ausente do estoque de origem era pausado na hora — uma queda momentânea no site do parceiro tirava carro bom do ar. Agora:

1. Não encontrado → `missing_checks + 1`, status `POSSIVELMENTE_INDISPONIVEL`, **continua publicado**
2. Ao atingir o limite (padrão 2, configurável) → `INDISPONIVEL` e sai do ar
3. Reapareceu → contador zera e volta a `DISPONIVEL`

## 8. Parceiros

Tela em **Parceiros** no menu lateral: cadastrar, editar, ativar/desativar, excluir com confirmação, pesquisar por nome, cidade, CNPJ ou WhatsApp. Cada linha mostra origem, contato, quantos veículos publicados e os contadores da última sincronização.

**Exclusão é bloqueada quando há veículo vinculado** (HTTP 409) e o sistema oferece desativar — isso evita órfãos no histórico de leads e de preço. Ativo/inativo persiste no banco.

## 9. Lead

A coluna "Veículo e origem" mostra o código interno, a origem, o **nome do parceiro** e a linha `anunciado · origem · margem`.

Isso vive **só no painel**. Nenhuma dessas informações entra em anúncio público, card, página de veículo ou conteúdo enviado ao cliente — as funções públicas continuam sendo as de `vehicle-origin.ts`, que dizem apenas "Lojista parceiro" sem nomear a loja.

## 10. Dashboard

Bloco "Estoque por origem": próprio, parceiras, particular, parceiros ativos, novos hoje, preços alterados hoje, possivelmente indisponíveis.

---

## 11. Testes realizados

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sem erros |
| `npx eslint .` | ✅ sem erros |
| `node --test tests/*.test.mjs` | ✅ **32/32** (23 antigos + 9 novos) |
| Sintaxe do sync (`node --check`) | ✅ |
| Import real do sync | ✅ falha só em `DATABASE_URL`, como esperado |
| SQL das migrations 011 e 012 | ✅ valida contra a gramática real do Postgres (`pgsql-parser`) |

Os 9 testes novos cobrem: faixa invertida, acréscimo dentro da faixa, arredondamento sem estourar o teto, determinismo, estoque próprio fora do `apply_to`, override manual, modo sem acréscimo, modo fixo, preço inválido e dedução de margem.

## 12. O que NÃO consegui testar

Sendo direto, porque muda o que você precisa fazer antes de publicar:

- **A migration 012 não foi executada.** Não há `.env` no repositório nem Postgres no meu ambiente. O SQL foi validado sintaticamente, mas ninguém rodou contra o seu banco.
- **Nenhuma tela foi aberta.** Sem banco, o site não sobe com dados. Não houve conferência visual.
- **O build de produção não terminou.** Os binários nativos do SWC não instalam no meu sandbox e o fallback WASM não concluiu no tempo disponível. Typecheck e lint passaram, que cobrem o mesmo tipo de erro, mas não é a mesma garantia.
- **O sync não rodou de verdade** contra a API da EasyCar com banco real.

**O primeiro passo aí é `npm run db:migrate`.** Antes disso as telas novas mostram um aviso explicando o que fazer, em vez de quebrar.

## 13. Problemas encontrados no sistema existente

**Senha do AutoConf na extensão.** `popup.html` tem `acEmail`, `acPassword` e `saveCreds` na seção "Login do AutoConf (auto-login)", enquanto o `README.md` afirma "Não salva senha do AutoConf". Conflita com o item 26 do seu roteiro. Não mexi — é decisão sua se remove o auto-login ou corrige o README.

**Quebra de linha CRLF no Git.** 112 arquivos aparecem como modificados sem nenhuma alteração real: `git diff --ignore-all-space` retorna vazio. Por isso os diffs de `globals.css`, `AdminLayout.tsx` e `admin/page.tsx` parecem enormes — a mudança real é pequena. Um `.gitattributes` com `* text=auto eol=lf` resolveria de vez, mas renormalizaria os 112 arquivos de uma vez, então preferi não fazer sem você decidir.

**`/admin/atacado` chamava-se "Parceiros" no menu** mas mostra "Leads de Parceiros" no próprio título. Renomeei o item do menu para o que a página realmente é.

## 14. Git

5 commits, lógicos e separados:

```
41a2fec feat: identifica origem e parceiro no lead e no dashboard multiorigem
894cd40 feat: adapta sync para preco de origem, alteracao de preco e carencia de indisponibilidade
a3cdd7b feat: adiciona regra de margem no preco publicado e identificacao interna do veiculo
ffc67ca feat: adiciona gestao de parceiros ao estoque
7073a8c style: adiciona classes de apoio do admin (feedback, acoes, perigo, precificacao)
```

Nada foi apagado. Nenhum arquivo não relacionado entrou nos commits. A extensão recebeu `git init` e um commit de baseline (`67df20d`, 23 arquivos), já que estava sem controle de versão nenhum.

**Atenção:** o repositório local está agora **10 commits à frente do GitHub** (`origin/main` parou em 15/09). Nada foi enviado — `git push` é decisão sua.

## 15. Pendências

**Depende de você:**
1. Rodar `npm run db:migrate`
2. Abrir as telas e conferir visualmente
3. Rodar `npm run sync:easycar` e conferir os contadores
4. Decidir sobre o `git push` e sobre a divergência com a VM
5. Decidir sobre a senha do AutoConf na extensão

**Fica para uma próxima etapa (itens do roteiro que são da extensão, não do site):**
- Grupo de abas do Chrome (item 3)
- URL configurável do ChatGPT (item 4)
- Estrutura local de pastas e fotos (itens 5 a 9, 24, 25, 29)
- Consulta ao estoque de parceiros pela extensão (hoje só a EasyCar é sincronizada, via API própria)

Sobre esses: a extensão hoje não tem nenhum código de estoque. Implementá-los é criar um módulo novo — o que contraria a sua Regra Principal se feito sem decidir antes onde ele deve morar. Vale conversarmos antes de eu começar.
