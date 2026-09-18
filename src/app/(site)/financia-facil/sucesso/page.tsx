import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Financia Fácil: solicitação enviada",
  robots: { index: false, follow: false },
};

export default function PrivateFinancingSuccessPage() {
  const whatsapp = `https://wa.me/5511934718276?text=${encodeURIComponent("Olá! Enviei uma solicitação do Financia Fácil para uma negociação particular pelo site da Autodrive.")}`;
  return (
    <>
      <section className="page-hero"><div className="shell">
        <p className="eyebrow">Financia Fácil · Solicitação enviada</p>
        <h1>Recebemos sua simulação.</h1>
        <p>A equipe Autodrive vai entrar em contato pelo telefone informado para seguir com a análise da sua negociação particular.</p>
      </div></section>
      <section className="shell section success-panel">
        <div><h2>Próximo passo</h2><p>Aguarde nosso contato para conferir as informações do veículo e as opções das financeiras. A solicitação ainda está sujeita à análise de crédito.</p></div>
        <div className="success-actions">
          <a className="button" href={whatsapp} target="_blank" rel="noreferrer">Falar pelo WhatsApp</a>
          <Link className="button button-outline" href="/">Voltar ao início</Link>
        </div>
      </section>
    </>
  );
}
