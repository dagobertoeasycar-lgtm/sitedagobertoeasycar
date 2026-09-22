import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleCard } from "@/components/VehicleCard";
import { listVehicles } from "@/lib/vehicles";
import { CIDADES, findCity, listBrandLandings } from "@/lib/seo-landings";
import { ENDERECO, MAPS_ROTA_URL } from "@/lib/endereco";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ cidade: string }> }): Promise<Metadata> {
  const { cidade } = await params;
  const city = findCity(cidade);
  if (!city) return {};
  const title = `Carros usados e seminovos em ${city.nome}`;
  const description = `Autodrive Veículos atende ${city.nome}: compra, venda, financiamento e avaliação na troca, com atendimento rápido pelo WhatsApp e escritório em Barueri.`;
  return { title, description, alternates: { canonical: `/carros-em/${city.slug}` }, openGraph: { title, description, url: `/carros-em/${city.slug}` } };
}

export default async function CityLandingPage({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade } = await params;
  const city = findCity(cidade);
  if (!city) notFound();

  const [vehicles, brands] = await Promise.all([
    listVehicles({ sort: "recent" }).then((list) => list.slice(0, 12)).catch(() => []),
    listBrandLandings().catch(() => []),
  ]);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Atendimento Autodrive</p>
          <h1>Carros usados e seminovos em {city.nome}</h1>
          <p>{city.texto} Financiamento, avaliação na troca e atendimento rápido pelo WhatsApp.</p>
        </div>
      </section>

      <section className="shell section">
        <h2 className="section-title">Últimos veículos no estoque</h2>
        <div className="vehicle-grid">
          {vehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}
        </div>
        <p className="mapa-acoes">
          <Link className="button" href="/veiculos">Ver o estoque completo</Link>
          <Link className="button button-outline" href="/financiamento">Simular financiamento</Link>
        </p>
      </section>

      <section className="shell section">
        <div className="prose">
          <h2>Como funciona o atendimento em {city.nome}</h2>
          <p>
            Você escolhe o veículo pelo site e fala com a equipe pelo WhatsApp. Combinamos a visita, a avaliação do seu usado na troca e
            a simulação de financiamento. O escritório fica em {ENDERECO.linha1}, {ENDERECO.linha2} —{" "}
            <a href={MAPS_ROTA_URL} target="_blank" rel="noreferrer">ver rota</a>. Visitas mediante agendamento.
          </p>
          <h2>Marcas mais procuradas</h2>
          <p className="landing-links" style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
            {brands.slice(0, 12).map((item) => <Link key={item.slug} href={`/carros/${item.slug}`}>{item.nome}</Link>)}
          </p>
          <h2>Outras cidades atendidas</h2>
          <p className="landing-links" style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
            {CIDADES.filter((item) => item.slug !== city.slug).map((item) => (
              <Link key={item.slug} href={`/carros-em/${item.slug}`}>{item.nome}</Link>
            ))}
          </p>
        </div>
      </section>
    </>
  );
}
