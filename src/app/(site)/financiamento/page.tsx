import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Financiamento",
  description: "Simule financiamento de veículo com atendimento da Autodrive, entrada facilitada e crédito sujeito à análise.",
};
export default function FinancingPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Crédito online</p><h1>Simule seu financiamento com a Autodrive.</h1><p>Atendimento para veículos próprios, parceiros e particulares intermediados. Consulte condições.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Simule com atendimento humano</h2><p>Envie seus dados básicos e a equipe apresentará as alternativas disponíveis, sem solicitar CPF nesta primeira etapa.</p><ul><li>Aprovação de crédito online.</li><li>Entrada facilitada em até 21x.</li><li>Financiamento em até 60x.</li><li>Atendimento transparente.</li></ul><div className="notice"><strong>Aviso obrigatório</strong><p>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</p></div></div><LeadForm kind="financing" title="Simular financiamento" /></section></>;
}
