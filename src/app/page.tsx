import Image from "next/image";
import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import { listVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vehicles = await listVehicles().catch(() => []);
  return (
    <>
      <section className="hero">
        <Image src="/vehicles/hero.avif" alt="Veículo em showroom automotivo" fill priority sizes="100vw" />
        <div className="hero-overlay" />
        <div className="shell hero-content">
          <p className="eyebrow">Seu próximo carro está aqui</p>
          <h1>Encontre o veículo ideal para você.</h1>
          <p>Diversas marcas e modelos, qualidade e procedência para comprar com segurança e transparência.</p>
          <div className="hero-actions"><Link className="button" href="/veiculos">Ver veículos</Link><a className="button button-light" href="https://wa.me/5511934718276">Falar pelo WhatsApp</a></div>
        </div>
      </section>

      <section className="shell search-strip">
        <form action="/veiculos"><label htmlFor="q">Buscar por marca, modelo ou veículo</label><div><input id="q" name="q" placeholder="Ex.: Corolla, SUV ou automático" /><button className="button">Buscar veículos</button></div></form>
      </section>

      <section className="shell section">
        <div className="section-heading"><div><p className="eyebrow dark">Estoque selecionado</p><h2>Veículos em destaque</h2></div><Link href="/veiculos">Ver todos os veículos →</Link></div>
        {vehicles.length ? <div className="vehicle-grid">{vehicles.slice(0, 6).map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}</div> : <div className="empty-state"><h3>Estoque em atualização</h3><p>Os anúncios serão publicados pelo painel administrativo. Fale com a equipe para consultar as opções disponíveis hoje.</p><a className="button" href="https://wa.me/5511934718276">Consultar pelo WhatsApp</a></div>}
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
