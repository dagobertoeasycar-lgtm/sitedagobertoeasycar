import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleCard } from "@/components/VehicleCard";
import { listVehicles, money } from "@/lib/vehicles";
import { findBrandBySlug, listBrandLandings } from "@/lib/seo-landings";
import { ENDERECO } from "@/lib/endereco";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ marca: string }> }): Promise<Metadata> {
  const { marca } = await params;
  const brand = await findBrandBySlug(marca);
  if (!brand) return {};
  const title = `${brand.nome} usados e seminovos em Barueri e Osasco`;
  const description = `${brand.total} ${brand.nome} disponíveis na Autodrive: financiamento, avaliação na troca e atendimento rápido pelo WhatsApp em Barueri, Osasco e região.`;
  return { title, description, alternates: { canonical: `/carros/${brand.slug}` }, openGraph: { title, description, url: `/carros/${brand.slug}` } };
}

export default async function BrandLandingPage({ params }: { params: Promise<{ marca: string }> }) {
  const { marca } = await params;
  const brand = await findBrandBySlug(marca);
  if (!brand) notFound();

  const [vehicles, brands] = await Promise.all([
    listVehicles({ brand: brand.nome, sort: "price_asc" }).catch(() => []),
    listBrandLandings().catch(() => []),
  ]);
  const precos = vehicles.map((vehicle) => vehicle.price_cents).filter(Boolean);
  const menor = precos.length ? Math.min(...precos) : 0;
  const maior = precos.length ? Math.max(...precos) : 0;

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Estoque Autodrive</p>
          <h1>{brand.nome} usados e seminovos</h1>
          <p>
            {brand.total} {brand.nome} disponíveis hoje{precos.length ? `, de ${money(menor)} a ${money(maior)}` : ""}. Financiamento,
            avaliação na troca e atendimento rápido pelo WhatsApp.
          </p>
        </div>
      </section>

      <section className="shell section">
        <div className="vehicle-grid">
          {vehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}
        </div>
        {!vehicles.length && <p>Sem {brand.nome} no estoque neste momento. Fale com a equipe: procuramos o modelo na rede de parceiros.</p>}
        <p className="mapa-acoes">
          <Link className="button" href={`/veiculos?brand=${encodeURIComponent(brand.nome)}`}>Ver todos com filtros</Link>
          <Link className="button button-outline" href="/encontre-seu-carro">Não achei o que queria</Link>
        </p>
      </section>

      <section className="shell section">
        <div className="prose">
          <h2>Comprar {brand.nome} na Autodrive</h2>
          <p>
            Trabalhamos com veículos próprios, de lojas parceiras e de particulares intermediados. Todo {brand.nome} anunciado passa por
            conferência de documentação e pode ser financiado, inclusive quando a compra é de um particular.
          </p>
          <p>
            Escritório: {ENDERECO.linha1}, {ENDERECO.linha2}. Atendimento presencial mediante agendamento.
          </p>
          <h2>Outras marcas no estoque</h2>
          <p className="landing-links" style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
            {brands.filter((item) => item.slug !== brand.slug).map((item) => (
              <Link key={item.slug} href={`/carros/${item.slug}`}>{item.nome} ({item.total})</Link>
            ))}
          </p>
        </div>
      </section>
    </>
  );
}
