import type { Metadata } from "next";
import { SellCarLeadForm } from "@/components/AutoDriveLeadForms";

export const metadata: Metadata = {
  title: "Pré-avaliação do veículo",
  description: "Envie dados e fotos reais do veículo para a pré-avaliação da Autodrive.",
};
export default function SellCarPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Pré-avaliação</p><h1>Envie seu carro para pré-avaliação.</h1><p>Você informa os dados e manda fotos reais. A Autodrive analisa e chama você pelo WhatsApp.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Como funciona</h2><ol><li>Preencha os dados principais do veículo.</li><li>Envie fotos reais do painel, interior, frente, laterais, motor, traseira, porta-malas, estepe e itens de segurança.</li><li>Nossa equipe faz uma pré-análise comercial.</li><li>Entramos em contato pelo WhatsApp para confirmar detalhes.</li><li>Se fizer sentido, definimos a melhor estratégia de divulgação e atendimento.</li></ol><p>A avaliação final depende de inspeção presencial, análise documental e disponibilidade comercial.</p><div className="notice"><strong>Fotos ajudam na avaliação</strong><p>Mostre também riscos, amassados, pneus, teto, motor e detalhes importantes. Quanto mais claro o material, melhor a pré-avaliação.</p></div></div><SellCarLeadForm /></section></>;
}
