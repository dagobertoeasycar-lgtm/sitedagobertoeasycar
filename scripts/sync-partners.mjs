/**
 * sync-partners.mjs — motor de sincronização multi-parceiro.
 *
 * Lê a lista de parceiros-fonte do banco e, para cada um:
 *   - parceiro ATIVO   → busca o estoque pelo conector dele e importa
 *   - parceiro INATIVO → despublica todo o estoque dele do site
 *
 * A falha de um parceiro não interrompe os outros: cada um roda no seu
 * próprio try, registra o erro em partners.last_error e o processo segue.
 *
 * Uso: node scripts/sync-partners.mjs [sync_source_id ...]
 * Variáveis: DATABASE_URL (obrigatória)
 */
import pg from "pg";
import {
  DEFAULT_PRICING_RULE,
  computePublishedPriceCents,
  normalizePricingRule,
  resolveMarkupCents,
} from "../src/lib/pricing.ts";

import * as autoconf from "./connectors/autoconf.mjs";
import * as bndvNext from "./connectors/bndv-next.mjs";
import * as bndvHtml from "./connectors/bndv-html.mjs";
import * as guiottiRsc from "./connectors/guiotti-rsc.mjs";

const CONECTORES = {
  [autoconf.id]: autoconf,
  [bndvNext.id]: bndvNext,
  [bndvHtml.id]: bndvHtml,
  [guiottiRsc.id]: guiottiRsc,
};

/** Piso de sanidade: origem às vezes publica carro a R$ 1 por erro de cadastro. */
const PRECO_MINIMO_CENTS = 100000; // R$ 1.000
const ANO_MINIMO = 1950;

import { exigirDatabaseUrl } from "./check-database-url.mjs";

const { resumo } = exigirDatabaseUrl();
const connectionString = process.env.DATABASE_URL;

const somenteEstes = process.argv.slice(2).filter((a) => !a.startsWith("-"));

function log(...args) {
  console.log(...args);
}

async function carregarRegras(client) {
  const r = await client
    .query("select key, value from app_settings where key in ('pricing_rule','stock_rule')")
    .catch(() => ({ rows: [] }));
  const porChave = new Map(r.rows.map((row) => [row.key, row.value]));
  const stock = porChave.get("stock_rule") || {};
  const checks = Math.trunc(Number(stock.missing_checks_before_inactive));
  return {
    pricing: porChave.has("pricing_rule") ? normalizePricingRule(porChave.get("pricing_rule")) : DEFAULT_PRICING_RULE,
    carencia: Number.isFinite(checks) && checks >= 1 ? checks : 2,
  };
}

function veiculoAceitavel(v) {
  if (!v.title || !v.externalId) return "sem título ou sem id";
  if (!v.originPriceCents || v.originPriceCents < PRECO_MINIMO_CENTS) return `preço implausível (${v.originPriceCents})`;
  if (v.yearModel && v.yearModel < ANO_MINIMO) return `ano implausível (${v.yearModel})`;
  return null;
}

/** Despublica todo o estoque de uma fonte. Usado quando o parceiro é desligado. */
async function desligarEstoque(client, parceiro) {
  const r = await client.query(
    `update vehicles
        set status = 'paused',
            stock_status = 'sold',
            availability_status = 'INDISPONIVEL',
            updated_at = now()
      where source_id = $1
        and status in ('published', 'draft')
      returning id`,
    [parceiro.sync_source_id],
  );
  const removidos = r.rowCount || 0;
  await client.query(
    `update partners
        set last_sync_at = now(), last_found = 0, last_imported = 0,
            last_changed = 0, last_removed = $2, last_error = null, last_error_at = null,
            updated_at = now()
      where id = $1`,
    [parceiro.id, removidos],
  );
  return removidos;
}

async function importarParceiro(client, parceiro, regras) {
  const conector = CONECTORES[parceiro.connector];
  if (!conector) throw new Error(`conector desconhecido: ${parceiro.connector}`);

  const config = parceiro.connector_config || {};
  const veiculos = await conector.collect(config, log);

  const contadores = { encontrados: veiculos.length, novos: 0, atualizados: 0, precoAlterado: 0, semAlteracao: 0, ignorados: 0, erros: 0 };
  const idsVistos = [];

  for (const v of veiculos) {
    const motivo = veiculoAceitavel(v);
    if (motivo) {
      contadores.ignorados++;
      log(`  ignorado ${v.externalId}: ${motivo}`);
      continue;
    }

    try {
      const anterior = (
        await client.query(
          `select id, origin_price_cents, price_cents, price_markup_cents, price_markup_mode
             from vehicles where source_id = $1 and external_id = $2 limit 1`,
          [parceiro.sync_source_id, v.externalId],
        )
      ).rows[0] || null;

      const markup = resolveMarkupCents(regras.pricing, {
        originPriceCents: v.originPriceCents,
        originType: "PARTNER",
        mode: anterior?.price_markup_mode,
        manualMarkupCents: anterior?.price_markup_cents,
      });
      const publicado = computePublishedPriceCents(v.originPriceCents, markup);
      const publicadoAntigo = v.oldPriceCents != null ? computePublishedPriceCents(v.oldPriceCents, markup) : null;

      const precoMudou =
        anterior != null &&
        anterior.origin_price_cents != null &&
        Number(anterior.origin_price_cents) !== v.originPriceCents;

      const r = await client.query(
        `insert into vehicles(
           source_id, external_id, slug, title, brand, model, version,
           year_make, year_model, price_cents, old_price_cents, mileage,
           fuel, transmission, body_type, city, color, doors,
           description, image_url, images, options, store,
           origin_type, partner_id, partner_external_id,
           status, stock_status, featured, promotion,
           origin_price_cents, price_markup_cents,
           availability_status, missing_checks, last_seen_at,
           plate, source_url, vehicle_type
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
           'PARTNER',$24,$25,
           'published','available',false,$26,
           $27,$28,
           'DISPONIVEL',0,now(),
           $29,$30,$31
         )
         on conflict (source_id, external_id) do update set
           slug=excluded.slug, title=excluded.title, brand=excluded.brand, model=excluded.model,
           version=excluded.version, year_make=excluded.year_make, year_model=excluded.year_model,
           price_cents=excluded.price_cents, old_price_cents=excluded.old_price_cents,
           mileage=excluded.mileage, fuel=excluded.fuel, transmission=excluded.transmission,
           body_type=excluded.body_type, color=excluded.color, doors=excluded.doors,
           description=excluded.description,
           -- Veículo com fotos travadas mantém as tratadas. Sem esta guarda, o
           -- sync devolveria as fotos da origem a cada 15 minutos e o trabalho
           -- de tratamento se repetiria para sempre.
           image_url = case when vehicles.photos_locked then vehicles.image_url else excluded.image_url end,
           images    = case when vehicles.photos_locked then vehicles.images    else excluded.images    end,
           options=excluded.options, store=excluded.store,
           origin_type='PARTNER', partner_id=excluded.partner_id,
           partner_external_id=excluded.partner_external_id,
           promotion=excluded.promotion,
           origin_price_cents=excluded.origin_price_cents,
           price_markup_cents=excluded.price_markup_cents,
           availability_status='DISPONIVEL', missing_checks=0, last_seen_at=now(),
           plate=excluded.plate, source_url=excluded.source_url, vehicle_type=excluded.vehicle_type,
           status='published', stock_status='available', updated_at=now()
         returning id, (xmax = 0) as inserido`,
        [
          parceiro.sync_source_id, v.externalId, v.slug, v.title, v.brand, v.model, v.version,
          v.yearMake, v.yearModel, publicado, publicadoAntigo, v.mileage,
          v.fuel, v.transmission, v.bodyType, parceiro.city || "", v.color, v.doors,
          v.description, v.imageUrl, JSON.stringify(v.media), JSON.stringify(v.options), parceiro.name,
          parceiro.id, v.externalId,
          v.promotion,
          v.originPriceCents, markup,
          v.plate, v.sourceUrl, v.vehicleType,
        ],
      );

      idsVistos.push(v.externalId);
      const id = r.rows[0].id;

      if (r.rows[0].inserido) {
        contadores.novos++;
      } else if (precoMudou) {
        contadores.atualizados++;
        contadores.precoAlterado++;
        await client.query(
          `insert into vehicle_price_history(
             vehicle_id, previous_origin_price_cents, new_origin_price_cents,
             previous_published_price_cents, new_published_price_cents, markup_cents, changed_by
           ) values ($1,$2,$3,$4,$5,$6,$7)`,
          [id, anterior.origin_price_cents, v.originPriceCents, anterior.price_cents, publicado, markup, `sync:${parceiro.sync_source_id}`],
        );
        log(`  preço alterado ${v.externalId}: ${anterior.origin_price_cents} → ${v.originPriceCents}`);
      } else {
        contadores.atualizados++;
        contadores.semAlteracao++;
      }
    } catch (e) {
      contadores.erros++;
      log(`  ERRO no veículo ${v.externalId}: ${e.message}`);
    }
  }

  // Ausentes ganham carência antes de sair do ar. Só aplica se a coleta
  // trouxe volume plausível — coleta vazia por falha não deve limpar o estoque.
  let ausentes = 0;
  let removidos = 0;
  if (idsVistos.length >= 5) {
    const r1 = await client.query(
      `update vehicles
          set missing_checks = missing_checks + 1,
              availability_status = case when missing_checks + 1 >= $3 then 'INDISPONIVEL' else 'POSSIVELMENTE_INDISPONIVEL' end,
              updated_at = now()
        where source_id = $1
          and external_id <> all($2::text[])
          and status in ('published','draft')
        returning id`,
      [parceiro.sync_source_id, idsVistos, regras.carencia],
    );
    ausentes = r1.rowCount || 0;

    const r2 = await client.query(
      `update vehicles
          set status='paused', stock_status='sold', updated_at=now()
        where source_id = $1
          and availability_status = 'INDISPONIVEL'
          and status in ('published','draft')
        returning id`,
      [parceiro.sync_source_id],
    );
    removidos = r2.rowCount || 0;
  } else if (veiculos.length === 0) {
    log(`  coleta vazia: estoque preservado por segurança`);
  }

  await client.query(
    `update partners
        set last_sync_at = now(), last_found = $2, last_imported = $3,
            last_changed = $4, last_removed = $5, last_error = null, last_error_at = null,
            updated_at = now()
      where id = $1`,
    [parceiro.id, contadores.encontrados, contadores.novos, contadores.precoAlterado, removidos],
  );

  return { ...contadores, ausentes, removidos };
}

async function main() {
  const client = new pg.Client({ connectionString, application_name: "autodrive_sync_partners" });
  await client.connect();
  log(`Banco: ${resumo}`);

  const lock = await client.query("select pg_try_advisory_lock(hashtext('autodrive_sync_partners')) as locked");
  if (!lock.rows[0]?.locked) {
    log("Sincronização anterior ainda em andamento; saindo.");
    await client.end();
    return;
  }

  try {
    const regras = await carregarRegras(client);
    log(
      `Regra de preço: ${regras.pricing.mode}` +
        (regras.pricing.mode === "fixed" ? ` (R$ ${(regras.pricing.fixed_cents / 100).toFixed(2)})` : "") +
        ` · carência: ${regras.carencia} verificação(ões)`,
    );

    const { rows: parceiros } = await client.query(
      `select id, name, city, sync_source_id, connector, connector_config, active
         from partners
        where connector is not null and sync_source_id is not null
        order by name`,
    );

    const alvo = somenteEstes.length
      ? parceiros.filter((p) => somenteEstes.includes(p.sync_source_id))
      : parceiros;

    if (!alvo.length) {
      log("Nenhum parceiro-fonte encontrado. Rodou a migration 013?");
      return;
    }

    const resumo = [];
    for (const parceiro of alvo) {
      const rotulo = `${parceiro.name} (${parceiro.sync_source_id})`;
      const run = await client.query(
        "insert into sync_runs(source_id, partner_id, source_label) values ($1,$2,$3) returning id",
        [parceiro.sync_source_id, parceiro.id, parceiro.name],
      );
      const runId = run.rows[0].id;

      if (!parceiro.active) {
        log(`\n— ${rotulo}: DESATIVADO`);
        try {
          const removidos = await desligarEstoque(client, parceiro);
          log(`  ${removidos} veículo(s) retirado(s) do site`);
          resumo.push({ parceiro: parceiro.name, estado: "desativado", removidos });
          await client.query(
            "update sync_runs set finished_at=now(), processed=0, skipped=$2 where id=$1",
            [runId, removidos],
          );
        } catch (e) {
          log(`  ERRO ao desligar: ${e.message}`);
          resumo.push({ parceiro: parceiro.name, estado: "erro", erro: e.message });
          await client.query("update sync_runs set finished_at=now(), errors=1 where id=$1", [runId]).catch(() => {});
        }
        continue;
      }

      log(`\n— ${rotulo}: conector ${parceiro.connector}`);
      try {
        const c = await importarParceiro(client, parceiro, regras);
        log(
          `  encontrados ${c.encontrados} · novos ${c.novos} · preço alterado ${c.precoAlterado} · ` +
            `sem alteração ${c.semAlteracao} · ignorados ${c.ignorados} · ausentes ${c.ausentes} · ` +
            `retirados ${c.removidos} · erros ${c.erros}`,
        );
        resumo.push({ parceiro: parceiro.name, estado: "ok", ...c });
        await client.query(
          `update sync_runs set finished_at=now(), processed=$2, created=$3, updated=$4,
                  skipped=$5, errors=$6, price_changed=$7, unchanged=$8, missing=$9
            where id=$1`,
          [runId, c.encontrados, c.novos, c.atualizados, c.removidos, c.erros, c.precoAlterado, c.semAlteracao, c.ausentes],
        );
      } catch (e) {
        // Parceiro B falhar não pode impedir o C de rodar.
        log(`  ERRO ao consultar estoque: ${e.message}`);
        resumo.push({ parceiro: parceiro.name, estado: "erro", erro: e.message });
        await client
          .query("update partners set last_error=$2, last_error_at=now(), last_sync_at=now(), updated_at=now() where id=$1", [
            parceiro.id,
            String(e.message).slice(0, 500),
          ])
          .catch(() => {});
        await client
          .query("update sync_runs set finished_at=now(), errors=1, details=$2::jsonb where id=$1", [
            runId,
            JSON.stringify({ error: String(e.message).slice(0, 500) }),
          ])
          .catch(() => {});
      }
    }

    log("\n===== RESUMO =====");
    for (const r of resumo) {
      if (r.estado === "erro") log(`  ${r.parceiro} — ERRO: ${r.erro}`);
      else if (r.estado === "desativado") log(`  ${r.parceiro} — desativado, ${r.removidos} veículo(s) retirado(s)`);
      else log(`  ${r.parceiro} — ${r.encontrados} encontrados, ${r.novos} novos, ${r.precoAlterado} com preço novo, ${r.removidos} retirados`);
    }
    const comErro = resumo.filter((r) => r.estado === "erro").length;
    log(`\n${resumo.length} parceiro(s) processado(s), ${comErro} com erro.`);
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('autodrive_sync_partners'))").catch(() => {});
    await client.end();
  }
}

await main();
