import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "Financiamento" };
export default function FinancingPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Crédito online</p><h1>Financiamento em até 60x, com ou sem entrada.</h1><p>Mais de 16 financeiras e entrada facilitada em até 21x. Consulte condições.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Simule com atendimento humano</h2><p>Envie seus dados básicos e a equipe apresentará as alternativas disponíveis, sem promessas de aprovação garantida.</p><ul><li>Aprovação de crédito online.</li><li>Entrada facilitada em até 21x.</li><li>Financiamento em até 60x.</li><li>Atendimento transparente.</li></ul><div className="notice"><strong>Aviso obrigatório</strong><p>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</p></div></div><LeadForm kind="financing" title="Solicitar simulação" /></section></>;
}
