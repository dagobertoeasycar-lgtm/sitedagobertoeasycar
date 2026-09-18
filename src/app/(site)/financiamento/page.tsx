import type { Metadata } from "next";
import { FinancingForm } from "@/components/FinancingForm";
import { listVehicleChoices } from "@/lib/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financiamento",
  description: "Simule financiamento de veículo com atendimento da Autodrive, entrada facilitada e crédito sujeito à análise.",
};

export default async function FinancingPage() {
  const vehicles = await listVehicleChoices().catch(() => []);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Crédito online</p>
          <h1>Simule seu financiamento com a Autodrive.</h1>
          <p>Escolha um veículo da vitrine ou informe um carro de amigos e conhecidos. A equipe retorna pelo WhatsApp com as alternativas disponíveis.</p>
        </div>
      </section>
      <section className="shell section content-grid">
        <div className="prose">
          <h2>Atendimento humano desde o primeiro contato</h2>
          <p>Você envia os dados básicos e a Autodrive organiza a conversa com as financeiras. Nesta primeira etapa não solicitamos CPF pelo site.</p>
          <ul>
            <li>Simulação para veículos do estoque publicado.</li>
            <li>Atendimento também para veículos de amigos e conhecidos.</li>
            <li>Entrada facilitada em até 21x, conforme análise.</li>
            <li>Financiamento em até 60x, sujeito à aprovação.</li>
          </ul>
          <div className="notice">
            <strong>Crédito responsável</strong>
            <p>As condições dependem da análise das instituições financeiras. A equipe confirma os próximos passos antes de qualquer envio de documentação.</p>
          </div>
        </div>
        <FinancingForm vehicles={vehicles} />
      </section>
    </>
  );
}
