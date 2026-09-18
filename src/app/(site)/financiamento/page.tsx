import type { Metadata } from "next";
import Link from "next/link";
import { FinancingForm } from "@/components/FinancingForm";
import { listVehicleChoices } from "@/lib/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financiamento",
  description: "Financie veículos de lojas parceiras com atendimento da Autodrive. Simulação e crédito sujeitos à análise.",
};

export default async function FinancingPage() {
  const vehicles = await listVehicleChoices(500, "PARTNER").catch(() => []);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Veículos de lojas parceiras</p>
          <h1>Financiamento</h1>
          <p>Escolha um veículo da nossa rede de parceiros. A Autodrive acompanha sua simulação e apresenta as alternativas disponíveis para a compra.</p>
        </div>
      </section>
      <section className="shell section content-grid">
        <div className="prose">
          <h2>Atendimento humano desde o primeiro contato</h2>
          <p>Você envia os dados básicos e a Autodrive organiza a conversa com as financeiras. Nesta primeira etapa não solicitamos CPF pelo site.</p>
          <ul>
            <li>Simulação para veículos publicados por lojas parceiras.</li>
            <li>Atendimento centralizado pela equipe Autodrive.</li>
            <li>Entrada facilitada em até 21x, conforme análise.</li>
            <li>Financiamento em até 60x, sujeito à aprovação.</li>
          </ul>
          <div className="notice">
            <strong>Crédito responsável</strong>
            <p>As condições dependem da análise das instituições financeiras. A equipe confirma os próximos passos antes de qualquer envio de documentação.</p>
          </div>
          <div className="finance-service-alternative">
            <h3>Vai comprar de um particular?</h3>
            <p>Para veículos de amigos, conhecidos ou negociações entre pessoas, conheça o nosso outro serviço.</p>
            <Link href="/financia-facil" className="button button-outline">Conhecer o Financia Fácil</Link>
          </div>
        </div>
        <FinancingForm vehicles={vehicles} service="partners" />
      </section>
    </>
  );
}
