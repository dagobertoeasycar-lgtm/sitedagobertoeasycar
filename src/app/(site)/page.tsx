import Link from "next/link";
import { ENDERECO } from "@/lib/endereco";
import { VehicleCard } from "@/components/VehicleCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { listVehicles } from "@/lib/vehicles";
import { query } from "@/lib/db";
import { ArrowRight, BadgeCheck, CarFront, CheckCircle2, CircleDollarSign, Handshake, MessageCircle, Search, ShieldCheck, Star, MapPin, HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const journeys = [
  { icon: CarFront, title: "Quero comprar um carro", text: "Estoque próprio, parceiros e particulares em um só lugar.", label: "Ver veículos", href: "/veiculos" },
  { icon: BadgeCheck, title: "Quero vender ou trocar", text: "Conte com nossa equipe para avaliar e anunciar seu veículo.", label: "Avaliar meu carro", href: "/venda-seu-carro" },
  { icon: Search, title: "Procuro um carro específico", text: "Nós procuramos o modelo que você quer na nossa rede.", label: "Pedir uma busca", href: "/encontre-seu-carro" },
  { icon: Handshake, title: "Quero ser parceiro", text: "Mais oportunidades para lojistas e profissionais do setor.", label: "Conhecer a parceria", href: "/parceiros" },
  { icon: CircleDollarSign, title: "Financiamento", text: "Escolha um veículo publicado por uma loja parceira.", label: "Simular financiamento", href: "/financiamento" },
];

type HomeTestimonial = { name: string; text: string; vehicle?: string };

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

async function getHomeTestimonials(): Promise<HomeTestimonial[]> {
  try {
    const result = await query<{ value: string }>("SELECT value FROM site_settings WHERE key='home_testimonials' LIMIT 1");
    const value = JSON.parse(result.rows[0]?.value || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is HomeTestimonial => Boolean(item && typeof item.name === "string" && typeof item.text === "string"))
      .slice(0, 6).map(item => ({ name: item.name.slice(0, 80), text: item.text.slice(0, 360), vehicle: typeof item.vehicle === "string" ? item.vehicle.slice(0, 100) : "" }));
  } catch { return []; }
}

export default async function Home() {
  const [vehicles, banners, carouselIntervalSeconds, testimonials] = await Promise.all([
    listVehicles().catch(() => []),
    getBanners(),
    getCarouselIntervalSeconds(),
    getHomeTestimonials(),
  ]);

  const homeHero = (
    <section className="hero home-hero">
      <div className="shell hero-grid">
        <div className="hero-content">
          <p className="eyebrow">Centenas de opções. Um só atendimento.</p>
          <h1>Modelos para todos os gostos.</h1>
          <p>Estoque próprio, veículos de parceiros e oportunidades de particulares em um só lugar. Você escolhe o caminho e a Autodrive acompanha a negociação.</p>
          <div className="hero-actions">
            <Link className="button" href="/veiculos"><CarFront size={19} aria-hidden="true" />Ver carros disponíveis</Link>
            <a className="button button-outline hero-outline" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer"><MessageCircle size={19} aria-hidden="true" />Falar com a equipe</a>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2 size={16} aria-hidden="true" />Atendimento único, humano e personalizado</span>
            <span><CheckCircle2 size={16} aria-hidden="true" />Opções de financiamento</span>
            <span><CheckCircle2 size={16} aria-hidden="true" />Rede de parceiros</span>
          </div>
        </div>
        <div className="hero-banner-frame">
          <BannerCarousel banners={banners} intervalSeconds={carouselIntervalSeconds} />
        </div>
      </div>
    </section>
  );

  const homeServices = (
    <section className="section home-services"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow dark">Como podemos ajudar?</p><h2>Escolha o caminho certo para o seu momento.</h2><p className="section-intro">A equipe direciona cada atendimento para a solução mais adequada.</p></div></div>
      <div className="service-panels">
        <article className="service-panel"><p className="eyebrow dark">Para quem vai comprar</p><h3>Financiamento</h3><p>Escolha um veículo anunciado por uma loja parceira e faça sua simulação com acompanhamento da Autodrive.</p><Link className="button button-dark" href="/financiamento">Escolher veículo e simular<ArrowRight size={17} aria-hidden="true" /></Link></article>
        <article className="service-panel service-panel-accent"><p className="eyebrow dark">Para negociações particulares</p><h3>Financia Fácil</h3><p>Encontrou um carro com um amigo, conhecido ou outro particular? Nós cuidamos do caminho com a financeira.</p><Link className="button" href="/financia-facil">Conhecer o Financia Fácil<ArrowRight size={17} aria-hidden="true" /></Link></article>
      </div>
    </div></section>
  );

  return (
    <>
      {homeHero}

      <section className="shell home-journeys" aria-label="Caminhos principais">
        {journeys.map(({ icon: Icon, title, text, label, href }) => (
          <Link href={href} className="journey-card" key={href}>
            <span className="journey-icon"><Icon size={23} aria-hidden="true" /></span>
            <h2>{title}</h2><p>{text}</p>
            <span className="journey-link">{label}<ArrowRight size={16} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      <section className="featured-showcase">
        <div className="shell">
        <div className="featured-heading">
          <div><p className="eyebrow dark">Seleção Autodrive</p><h2>Encontre o carro certo para o seu momento.</h2><p>Compare as oportunidades da nossa rede e fale com a equipe para consultar disponibilidade e condições.</p></div>
          <Link className="button button-dark" href="/veiculos">Ver todo o estoque<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        {vehicles.length ? <div className="vehicle-grid">{vehicles.slice(0, 8).map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}</div> : <div className="empty-state"><h3>Estoque em atualização</h3><p>Os anúncios serão publicados pelo painel administrativo.</p><a className="button" href="https://wa.me/5511934718276">Consultar pelo WhatsApp</a></div>}
        </div>
      </section>

      <section className="benefits"><div className="shell benefit-grid">
        <div><ShieldCheck size={28} aria-hidden="true" /><strong>Veículos periciados</strong><span>Procedência e verificação antes da venda.</span></div>
        <div><CircleDollarSign size={28} aria-hidden="true" /><strong>Entrada em até 21x</strong><span>Entrada facilitada. Consulte condições.</span></div>
        <div><CarFront size={28} aria-hidden="true" /><strong>Financiamento em até 60x</strong><span>Com ou sem entrada. Consulte condições.</span></div>
        <div><BadgeCheck size={28} aria-hidden="true" /><strong>Mais de 16 financeiras</strong><span>Aprovação de crédito online.</span></div>
      </div></section>

      {homeServices}

      <section className="shell section">
        <div className="section-heading"><div><p className="eyebrow dark">Como trabalhamos</p><h2>Duas formas de fazer negócio.</h2></div></div>
        <div className="how-grid">
          <div className="how-card">
            <strong>Negócios com particulares</strong>
            <p>Intermediamos a compra e a venda entre pessoas, com toda a segurança que esse tipo de negócio exige.</p>
            <ul>
              <li>Veículo periciado antes do negócio</li>
              <li>Checagem de procedência</li>
              <li>Acompanhamento da documentação e da transferência</li>
              <li>Negociação conduzida do começo ao fim</li>
            </ul>
          </div>
          <div className="how-card">
            <strong>Veículos de parceiros lojistas</strong>
            <p>Os veículos que vêm das lojas parceiras saem com as garantias oferecidas pelo lojista.</p>
            <ul>
              <li>Garantia de 90 dias</li>
              <li>Laudo cautelar</li>
              <li>Acompanhamento da documentação e da transferência</li>
              <li>Procedência verificada pela loja de origem</li>
            </ul>
          </div>
        </div>
        <p className="legal-note">* Somos somente intermediadores. Garantia, laudo cautelar e procedência são de responsabilidade dos vendedores.</p>
      </section>

      <section className="section home-partner-band" id="parceiros"><div className="shell home-partner-grid">
        <div><p className="eyebrow">Para lojistas e profissionais do setor</p><h2>Quero ser parceiro Autodrive.</h2><p>Ofereça veículos do seu estoque, encontre oportunidades para sua loja e conte com uma equipe para acompanhar a negociação.</p><div className="partner-points"><span><Handshake size={18} aria-hidden="true" />Ofereça seu estoque</span><span><Search size={18} aria-hidden="true" />Encontre carros para sua loja</span><span><ShieldCheck size={18} aria-hidden="true" />Análise comercial e atendimento acompanhado</span></div></div>
        <div className="partner-actions"><Link className="button button-light" href="/parceiros">Quero ser parceiro</Link><a className="button partner-outline" href="https://wa.me/5511934718276?text=Ol%C3%A1!%20Quero%20ser%20parceiro%20da%20Autodrive." target="_blank" rel="noreferrer">Falar com a equipe</a></div>
      </div></section>

      {testimonials.length > 0 && <section className="section section-soft"><div className="shell"><div className="section-heading"><div><p className="eyebrow dark">Experiências reais</p><h2>Quem negocia com a Autodrive recomenda.</h2></div></div><div className="testimonial-grid">{testimonials.map(item => <article className="testimonial-card" key={`${item.name}-${item.text}`}><Star size={20} aria-hidden="true" /><p>“{item.text}”</p><strong>{item.name}</strong>{item.vehicle && <span>{item.vehicle}</span>}</article>)}</div></div></section>}

      <section className="section"><div className="shell home-faq-location"><div className="faq-block"><div className="section-heading"><div><p className="eyebrow dark"><HelpCircle size={15} aria-hidden="true" /> Dúvidas frequentes</p><h2>Negocie com mais tranquilidade.</h2></div></div><details><summary>A Autodrive trabalha com financiamento?</summary><p>Sim. Oferecemos simulações para veículos de lojas parceiras e, pelo Financia Fácil, para negociações particulares. Toda proposta está sujeita à análise.</p></details><details><summary>Posso comprar de um amigo e financiar?</summary><p>Sim. Acesse o Financia Fácil e informe os dados do veículo da negociação para nossa equipe orientar os próximos passos.</p></details><details><summary>Posso vender ou trocar meu carro?</summary><p>Sim. Envie os dados pela página Venda seu carro para uma avaliação inicial da equipe.</p></details></div><div className="location-panel"><MapPin size={24} aria-hidden="true" /><p className="eyebrow dark">Atendimento Autodrive</p><h3>Escritório em Barueri.</h3><p>{ENDERECO.linha1}<br />{ENDERECO.linha2}</p><p>Financiamento, avaliação na troca e atendimento rápido pelo WhatsApp. Visitas mediante agendamento.</p><Link className="button button-outline" href="/contato">Falar com a equipe</Link></div></div></section>

      <section className="home-action-band">
        <div className="shell home-action-grid">
          <div>
            <p className="eyebrow dark">Tem um veículo para vender?</p>
            <h2>Anuncie com a Autodrive e deixe nossa equipe cuidar dos interessados.</h2>
            <Link className="button" href="/venda-seu-carro">Anunciar meu veículo</Link>
          </div>
          <div>
            <p className="eyebrow dark">É lojista?</p>
            <h2>Amplie a exposição do seu estoque e gere novas oportunidades.</h2>
            <Link className="button button-outline" href="/parceiros">Quero ser parceiro</Link>
          </div>
          <div>
            <p className="eyebrow dark">Não encontrou o carro que procura?</p>
            <h2>Conte para a Autodrive. Nós procuramos em nossa rede.</h2>
            <Link className="button" href="/encontre-seu-carro">Encontre meu carro</Link>
          </div>
        </div>
      </section>

      <section className="shell split-section section"><div><p className="eyebrow dark">Sobre a Autodrive Veículos</p><h2>Vários parceiros, um só atendimento.</h2><p>Trabalhamos com vários parceiros para reunir vários modelos para todos os gostos, com negociação fácil e rápida do primeiro contato ao pós-venda.</p><Link className="button button-outline" href="/sobre">Conheça nossa história</Link></div><div className="notice"><strong>Crédito responsável</strong><p>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</p></div></section>

      <section className="contact-band"><div className="shell"><div><p className="eyebrow">Fale com a gente</p><h2>Nossa equipe está pronta para atender.</h2></div><div className="contact-links"><a href="tel:+5511934718276"><span>Telefone e WhatsApp</span><strong>(11) 93471-8276</strong></a><a href="https://wa.me/5511934718276" target="_blank" rel="noreferrer"><span>Negociação fácil e rápida</span><strong>Falar pelo WhatsApp</strong></a></div></div></section>
    </>
  );
}
