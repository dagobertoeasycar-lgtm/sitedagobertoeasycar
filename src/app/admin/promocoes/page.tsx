import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { brl } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type PromoRow = { id: string; title: string; internal_code: string | null; price_cents: number; old_price_cents: number | null; featured: boolean; source_id: string | null; image_url: string | null };
type BannerCount = { total: number; active: number };

export default async function PromotionsPage() {
  await requireArea("banners");

  const [promos, featured, banners] = await Promise.all([
    query<PromoRow>(`select id, title, internal_code, price_cents, old_price_cents, featured, source_id, image_url
      from vehicles where status='published' and promotion order by updated_at desc limit 100`).then((r) => r.rows).catch(() => []),
    query<{ total: number }>("select count(*)::int as total from vehicles where status='published' and featured").then((r) => r.rows[0]?.total ?? 0).catch(() => 0),
    query<BannerCount>("select count(*)::int as total, count(*) filter (where active)::int as active from banners").then((r) => r.rows[0]).catch(() => undefined),
  ]);
  const withDiscount = promos.filter((p) => p.old_price_cents && p.old_price_cents > p.price_cents);

  const cards = [
    { label: "Banners da home", value: `${banners?.active ?? 0} ativo(s)`, note: `${banners?.total ?? 0} cadastrado(s)`, href: "/admin/banners" },
    { label: "Anúncios em promoção", value: `${promos.length} ativo(s)`, note: `${withDiscount.length} com preço anterior riscado`, href: "/admin/veiculos?status=promotion" },
    { label: "Veículos em destaque", value: `${featured} ativo(s)`, note: "aparecem primeiro na vitrine", href: "/admin/veiculos?featured=1" },
    { label: "Catálogo Meta", value: "Feed automático", note: "promoções entram no catálogo", href: "/admin/configuracoes/integracoes/meta" },
  ];

  return (
    <>
      <div className="adm-header"><h1>Promoções</h1></div>
      <div className="ad-mini-cards">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="ad-mini-card">
            <span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small>
          </Link>
        ))}
      </div>

      <section className="adm-card">
        <div className="adm-card-header"><h2>Anúncios em promoção</h2></div>
        <p className="ad-note" style={{ marginBottom: 10 }}>
          Em anúncios de parceiro a promoção acompanha a fonte. Nos anúncios próprios, marque ou desmarque na aba
          “Preço e condições” do editor.
        </p>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Foto</th><th>Veículo</th><th>De</th><th>Por</th><th>Desconto</th><th>Destaque</th></tr></thead>
            <tbody>
              {promos.map((p) => {
                const discount = p.old_price_cents && p.old_price_cents > p.price_cents
                  ? Math.round(((p.old_price_cents - p.price_cents) / p.old_price_cents) * 100)
                  : null;
                return (
                  <tr key={p.id}>
                    <td><img src={p.image_url || "/em-breve.png"} alt="" className="adm-thumb" /></td>
                    <td><Link href={`/admin/veiculos/${p.id}`} className="ad-row-title">{p.title}</Link>{p.internal_code && <><br /><small>#{p.internal_code}</small></>}</td>
                    <td>{p.old_price_cents ? <s>{brl(p.old_price_cents)}</s> : "—"}</td>
                    <td><strong>{brl(p.price_cents)}</strong></td>
                    <td>{discount !== null ? <span className="adm-badge promotion">-{discount}%</span> : "—"}</td>
                    <td>{p.featured ? "★" : ""}</td>
                  </tr>
                );
              })}
              {!promos.length && <tr><td colSpan={6} className="adm-empty-row">Nenhum anúncio em promoção agora.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
