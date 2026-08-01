import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { listVehicles } from "@/lib/vehicles";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getBanners() {
  try {
    const result = await query("SELECT * FROM banners WHERE active = true ORDER BY sort_order ASC, id ASC");
    return result.rows as { id: number; title: string; image_url: string; link_url: string; link_target: string }[];
  } catch {
    return [];
  }
}

async function getCarouselIntervalSeconds() {
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM site_settings WHERE key='banner_interval_seconds' LIMIT 1",
    );
    const interval = Number(result.rows[0]?.value);
    return Number.isInteger(interval) && interval >= 1 && interval <= 300 ? interval : 5;
  } catch {
    return 5;
  }
}

export default async function Home() {
  const [vehicles, banners, carouselIntervalSeconds] = await Promise.all([
    listVehicles().catch(() => []),
    getBanners(),
    getCarouselIntervalSeconds(),
  ]);

  return (
    <>
      {/* Banner carousel - managed from admin */}
      {banners.length > 0 ? (
        <BannerCarousel banners={banners} intervalSeconds={carouselIntervalSeconds} />
      ) : (
        <section className="hero">
          <img src="/vehicles/hero.avif" alt="Veículo em showroom automotivo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div className="hero-overlay" />
          <div className="shell hero-content">
            <p className="eyebrow">Seu próximo carro está aqui</p>
            <h1>Encontre o veículo ideal para você.</h1>
            <p>Diversas marcas e modelos, qualidade e procedência para comprar com segurança e transparência.</p>
            <div className="hero-actions"><Link className="button" href="/veiculos">Ver veículos</Link><a className="button button-light" href="https://wa.me/5511934718276">Falar pelo WhatsApp</a></div>
          </div>
        </section>
      )}

      <section className="shell search-strip">
        <form action="/veiculos"><label htmlFor="q">Buscar por marca, modelo ou veículo</label><div><input id="q" name="q" placeholder="Ex.: Corolla, SUV ou automático" /><button className="button">Buscar veículos</button></div></form>
      </section>

      <section className="shell section">
        <div className="section-heading"><div><p className="eyebrow dark">Estoque selecionado</p><h2>Veículos em destaque</h2></div><Link href="/veiculos">Ver todos os veículos →</Link></div>
        {vehicles.length ? <div className="vehicle-grid">{vehicles.slice(0, 6).map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}</div> : <div className="empty-state"><h3>Estoque em atualização</h3><p>Os anúncios serão publicados pelo painel administrativo.</p><a className="button" href="https://wa.me/5511934718276">Consultar pelo WhatsApp</a></div>}
      </section>

      <section className="benefits"><div className="shell benefit-grid">
        <div><strong>Veículos periciados</strong><span>Procedência e verificação antes da venda.</span></div>
        <div><strong>Entrada em até 21x</strong><span>Entrada facilitada. Consulte condições.</span></div>
        <div><strong>Financiamento em até 60x</strong><span>Com ou sem entrada. Consulte condições.</span></div>
        <div><strong>Mais de 16 financeiras</strong><span>Aprovação de crédito online.</span></div>
      </div></section>

      <section className="shell split-section section"><div><p className="eyebrow dark">Sobre a Dagoberto Easycar</p><h2>Tradição, transparência e dedicação.</h2><p>Diversas marcas e modelos, qualidade e procedência, atendimento especializado e o melhor pós-venda.</p><Link className="button button-outline" href="/sobre">Conheça nossa história</Link></div><div className="notice"><strong>Crédito responsável</strong><p>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</p></div></section>

      <section className="contact-band"><div className="shell"><div><p className="eyebrow">Fale com a gente</p><h2>Nossa equipe está pronta para atender.</h2></div><div className="contact-links"><a href="tel:+5511934718276"><span>Telefone e WhatsApp</span><strong>(11) 93471-8276</strong></a><a href="mailto:meucomercioonline5@gmail.com"><span>E-mail</span><strong>meucomercioonline5@gmail.com</strong></a></div></div></section>
    </>
  );
}
