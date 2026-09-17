# Relatório — Sincronização multi-parceiro

Data: 17/09/2026 · Repositório: `_envio_github\repo`

---

## 1. Respondendo primeiro à sua dúvida

> "não sei se é por extensão ou sistema do painel do site"

**É o site.** A sincronização roda em `.github/workflows/sync-estoque.yml`, um agendamento do GitHub Actions que dispara a cada 15 minutos, aplica migrations e executa um script Node contra o banco. A extensão do Chrome não participa disso — ela importa negociações do AutoConf para cálculo de comissão, coisa completamente separada.

Antes desta entrega havia **uma única fonte**, a EasyCar, com o script `sync-easycar.mjs` amarrado a ela. Agora existe um motor que lê a lista de parceiros do banco.

## 2. Análise das quatro plataformas

Cada site usa uma tecnologia diferente. Não havia como reaproveitar um único leitor.

| Parceiro | Plataforma | Como o estoque é servido | Estratégia |
|---|---|---|---|
| **Tchesco Car** | Autoconf | `GET /api/stock` em JSON | Mesma API da EasyCar — mapeador reaproveitado |
| **Justo Car** | BNDV em Next.js | Dados em `__NEXT_DATA__` da página | Lê a listagem e extrai o JSON embutido |
| **Now Car** | BNDV em site próprio | HTML puro, sem API | Lê a listagem e visita cada anúncio |
| **Guiotti** | Supabase + Next app router | Payload RSC injetado no HTML | Remonta o payload e extrai o array |

Detalhes que importaram:

- **Tchesco Car** roda na mesma plataforma da EasyCar. Foi o mais simples: só apontar a URL base.
- **Justo Car** tem `/_next/data/{buildId}/…json`, que seria mais limpo, mas o `buildId` muda a cada deploy do parceiro. Optei por ler a página de listagem — imune a isso.
- **Now Car** não tem API. A listagem traz foto, ano, km, título e preço; a ficha completa (combustível, câmbio, cor, portas) só existe na página do anúncio. O conector visita as 53 páginas. Levou 42 segundos na medição real, com 0,3 s por página.
- **Guiotti** vende **carro e moto**: 12 motos e 7 carros. A plataforma expõe `vehicle_type`, então dá para separar. Deixei configurado para importar **somente carros** — moto no catálogo de uma revenda de carro poluiria o site e o feed da Meta. Para trazer tudo, é um seletor na tela de Parceiros.

## 3. Resultado medido

Coleta real executada em 17/09/2026:

| Parceiro | Carros | Tempo |
|---|---|---|
| Tchesco Car | 60 | 0,7 s |
| Justo Car | 28 | 2,1 s |
| Guiotti | 7 | 3,0 s |
| Now Car | 53 | 42,1 s |
| **Total novo** | **148** | **~48 s** |

Somados aos ~144 da EasyCar, o site passa a publicar cerca de **292 veículos**.

Qualidade dos dados coletados: Now Car veio com ficha completa em 53 de 53 e média de 9,3 fotos por carro; Justo Car traz até a **placa** dos veículos, útil como segunda chave de deduplicação.

## 4. Liga e desliga

É o que você pediu, e funciona nos dois sentidos.

**Ao desativar um parceiro**, na sincronização seguinte o motor entra no caminho `desligarEstoque()` e despublica todo o estoque daquele parceiro: `status='paused'`, `stock_status='sold'`, `availability_status='INDISPONIVEL'`. Os carros somem do site, dos filtros e do feed.

**Ao reativar**, a sincronização seguinte reimporta e republica. Nada foi apagado — o histórico de preço e os leads vinculados continuam lá.

Na tela, desativar um parceiro que sincroniza pede confirmação dizendo quantos veículos vão sair do ar. Achei importante porque a ação tem efeito visível no site público.

## 5. Proteções que coloquei

**Falha de um parceiro não derruba os outros.** Cada parceiro roda no próprio `try`. Erro é gravado em `partners.last_error`, aparece na tela, e o processo continua no parceiro seguinte. É o seu item 36.

**Coleta vazia não limpa o estoque.** Se um parceiro devolver zero veículos — site fora do ar, mudança de layout — o motor preserva o que já está publicado e registra o aviso. Sem essa regra, uma queda de dez minutos no site do parceiro apagaria o estoque dele do seu site.

**Carência antes de retirar.** Veículo que desaparece da origem vira `POSSIVELMENTE_INDISPONIVEL` e **continua publicado**. Só sai do ar após o número de verificações configurado (padrão 2).

**Piso de preço.** A origem às vezes publica carro a R$ 1 por erro de cadastro — encontrei 7 casos assim no Tchesco Car. Veículo abaixo de R$ 1.000 é descartado com o motivo no log.

**Tipo desconhecido não descarta.** O filtro de carros só exclui o que é reconhecidamente moto, caminhão, ônibus ou náutico. Rótulo novo ou vazio passa, para não perder carro por causa de uma categoria que o parceiro inventou.

## 6. Arquivos

**Criados**

| Arquivo | Papel |
|---|---|
| `scripts/connectors/shared.mjs` | Utilidades e formato normalizado comum |
| `scripts/connectors/autoconf.mjs` | EasyCar e Tchesco Car |
| `scripts/connectors/bndv-next.mjs` | Justo Car |
| `scripts/connectors/bndv-html.mjs` | Now Car |
| `scripts/connectors/guiotti-rsc.mjs` | Guiotti |
| `scripts/sync-partners.mjs` | Motor: percorre parceiros, importa ou desliga |
| `migrations/013_partner_connectors.sql` | Colunas de conector, os 4 parceiros, `plate`, `source_url` |
| `tests/partner-connectors.test.mjs` | 12 testes das rotinas de parsing |

**Alterados**

| Arquivo | Alteração |
|---|---|
| `.github/workflows/sync-estoque.yml` | Passa a chamar `sync-partners.mjs` |
| `package.json` | Script `sync:partners` |
| `src/lib/partners.ts` | Tipos do conector, merge de configuração, validação |
| `src/app/api/admin/partners/route.ts` | Grava conector e configuração |
| `src/app/api/admin/partners/[id]/route.ts` | Edita conector preservando ajustes finos |
| `src/components/PartnersAdmin.tsx` | Campos de sincronização, coluna nova, confirmação ao desligar |

O `sync-easycar.mjs` **não foi removido** — continua funcionando e disponível em `npm run sync:easycar`. A EasyCar agora também é um parceiro do motor novo, com o mesmo `source_id`, então não há duplicação de veículos.

## 7. Testes

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npx eslint .` | ✅ |
| `node --test tests/*.test.mjs` | ✅ **45/45** |
| SQL da migration 013 | ✅ valida na gramática do Postgres |
| Coleta real dos 4 parceiros | ✅ 148 carros |
| Sintaxe e import de todos os scripts | ✅ |

Os 12 testes novos cobrem: conversão de preço em três formatos, teto do integer, km absurdo, entidades HTML, acentuação de slug, filtro de tipo (incluindo rótulo desconhecido), extração de JSON com colchete dentro de string, remontagem do payload RSC, página que não é Next e limites do registro normalizado.

## 8. O que ainda não foi testado

Igual à entrega anterior, e pelo mesmo motivo: **não tenho o banco**.

- A migration 013 não rodou. O SQL foi validado sintaticamente.
- Nenhuma escrita no banco foi exercitada: o upsert, o histórico de preço e o desligamento de parceiro estão verificados apenas por leitura de código e tipo.
- Não abri nenhuma tela.

O que **foi** testado de verdade é a parte que mais poderia dar errado: a leitura dos quatro sites, com dados reais, agora.

## 9. Para colocar no ar

1. `ENVIAR10.bat` — envia os commits
2. **Actions → Sincronizar estoque EasyCar → Run workflow** — aplica as migrations 012 e 013 e roda o motor
3. Conferir o log do Actions: deve listar os 5 parceiros com os contadores
4. Abrir `/admin/parceiros` e ver as 5 linhas com o adaptador de cada um
5. Teste do liga-desliga: desativar o Guiotti, rodar o workflow, confirmar que os 7 carros dele saíram do site, reativar e rodar de novo

## 10. Pendências e observações

**Fica para decidir com você:**

- **Guiotti importa só carros.** Se quiser as 12 motos, é trocar o seletor para "Tudo, inclusive moto" — mas aí o feed da Meta também vai levar moto.
- **Cidade dos parceiros está vazia.** Usei o campo `city` do parceiro como cidade do veículo. Sem preencher, o veículo fica sem cidade, o que afeta o texto de localização no site. Vale preencher na tela de Parceiros.
- **Now Car leva 42 s** porque visita cada anúncio. Se quiser mais rápido, dá para desligar `fetchDetails` — mas aí perde combustível, câmbio e cor, que o feed da Meta usa.

**Itens do roteiro que continuam sendo da extensão** (grupo de abas, URL do ChatGPT, pastas locais de fotos): seguem pendentes e continuam precisando daquela decisão de onde o módulo deve morar. A sincronização de parceiros, que era o quarto item daquela lista, **saiu da extensão e foi resolvida no site** — que é onde ela pertencia.
