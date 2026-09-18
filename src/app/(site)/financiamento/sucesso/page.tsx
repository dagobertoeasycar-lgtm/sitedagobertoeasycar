import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Financiamento enviado",
  description: "Confirmação de envio da solicitação de financiamento para a Autodrive.",
  robots: { index: false, follow: false },
};

export default function FinancingSuccessPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Financiamento de parceiros · Solicitação enviada</p>
          <h1>Recebemos sua simulação.</h1>
          <p>A equipe da Autodrive vai analisar as informações e chamar você pelo WhatsApp para seguir com as opções disponíveis.</p>
        </div>
      </section>
      <section className="shell section success-panel">
        <div>
          <h2>Próximo passo</h2>
          <p>Fique atento ao telefone informado. Se quiser adiantar o atendimento, chame a Autodrive pelo WhatsApp e diga que acabou de enviar uma simulação pelo site.</p>
        </div>
        <div className="success-actions">
          <a className="button" href="https://wa.me/5511934718276?text=Ol%C3%A1!%20Enviei%20uma%20simula%C3%A7%C3%A3o%20de%20financiamento%20pelo%20site%20da%20Autodrive." target="_blank" rel="noreferrer">Falar pelo WhatsApp</a>
          <Link className="button button-outline" href="/veiculos">Ver estoque</Link>
        </div>
      </section>
    </>
  );
}
