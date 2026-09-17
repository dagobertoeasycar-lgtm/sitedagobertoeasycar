-- ============================================================================
-- 016_preco_sanidade_e_liberar_markup.sql
--
-- Duas correções de preço encontradas ao conferir o banco de produção em
-- 17/09/2026, com o estoque em 259 veículos e 223 publicados.
--
-- ── 1. Faixa de preço plausível ──────────────────────────────────────────────
-- Havia sete veículos no ar com valor de espaço reservado vindo da origem:
-- três Fiorino e um Onix a R$ 3.333.333,33 e um Onix, um Cronos e uma Strada
-- a R$ 1.000.000. A mediana do estoque é R$ 79.000. São valores que a loja de
-- origem digita quando não quer publicar o preço; chegaram ao site e ao
-- catálogo da Meta como se fossem reais.
--
-- Daqui para frente os dois scripts de sync consultam esta faixa e gravam o
-- veículo como rascunho em vez de publicado quando o preço cai fora dela.
-- Rascunho continua visível no painel: nada é apagado nem escondido do Beto.
--
-- ── 2. Liberar o markup congelado ────────────────────────────────────────────
-- A migration 012 marcou price_markup_mode='none' em todo o estoque que já
-- existia, de propósito, para não mexer em nenhum preço anunciado no dia em
-- que o acréscimo entrou no ar. O efeito colateral é que esse congelamento
-- nunca foi desfeito: 169 veículos ficaram com acréscimo zero para sempre, e
-- 133 deles estão publicados. Ou seja, dois terços do estoque no ar não têm
-- os R$ 2.000 que o Beto pediu.
--
-- Esta migration devolve mode='auto' nesses veículos. Ela não altera nenhum
-- preço: quem recalcula é o próximo sync, aplicando a regra de pricing_rule.
-- Veículos em 'manual' não são tocados — ali o valor foi escolhido à mão.
--
-- COMO DESFAZER, se o Beto não quiser o reajuste:
--     UPDATE vehicles SET price_markup_mode = 'none', price_markup_cents = 0,
--            price_cents = origin_price_cents
--      WHERE price_markup_mode = 'auto' AND origin_type IN ('PARTNER','PRIVATE');
-- O histórico de cada mudança fica em vehicle_price_history, e
-- origin_price_cents guarda o preço da origem sem acréscimo.
-- ============================================================================

-- ── 1. Faixa de preço aceitável ──────────────────────────────────────────────
-- Mínimo R$ 3.000 e máximo R$ 900.000. O teto dá folga larga: o carro mais
-- caro legítimo do estoque hoje é um Volvo XC a R$ 459.980.
INSERT INTO app_settings(key, value)
VALUES ('price_sanity', '{"min_cents":300000,"max_cents":90000000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Tira do ar os que já estão publicados com preço fora da faixa. Vão para
-- rascunho, não para excluído: o Beto decide se corrige na origem ou remove.
UPDATE vehicles v
   SET status = 'draft',
       updated_at = now(),
       internal_notes = concat_ws(
         E'\n',
         nullif(v.internal_notes, ''),
         'Despublicado automaticamente pela migration 016 em ' ||
         to_char(now(), 'DD/MM/YYYY') || ': preço R$ ' ||
         to_char(v.price_cents / 100.0, 'FM999G999G999D00') ||
         ' fora da faixa plausível (R$ 3.000 a R$ 900.000). Provável valor de ' ||
         'espaço reservado no estoque de origem. Corrija na origem e o sync republica.'
       )
 WHERE v.status = 'published'
   AND (v.price_cents < 300000 OR v.price_cents > 90000000);

-- ── 2. Liberar o congelamento do acréscimo ───────────────────────────────────
UPDATE vehicles
   SET price_markup_mode = 'auto',
       updated_at = now()
 WHERE price_markup_mode = 'none'
   AND origin_type IN ('PARTNER', 'PRIVATE');
