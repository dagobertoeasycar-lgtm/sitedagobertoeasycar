import type { Metadata } from "next";
import { SellCarLeadForm } from "@/components/AutoDriveLeadForms";

export const metadata: Metadata = { title: "Venda seu carro" };
export default function SellCarPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Captação de particulares</p><h1>Venda seu carro com a Autodrive</h1><p>Você tem o veículo. A Autodrive cuida da divulgação e dos interessados.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Como funciona</h2><ol><li>Cadastre o veículo.</li><li>Nossa equipe analisa as informações.</li><li>Definimos a melhor estratégia de divulgação.</li><li>Apresentamos o veículo aos interessados.</li><li>Atendemos os contatos e filtramos oportunidades reais.</li><li>Ajudamos na negociação e nos próximos passos.</li></ol><p>A avaliação final depende de inspeção presencial, análise documental e disponibilidade comercial.</p><div className="notice"><strong>Atendimento pela Autodrive</strong><p>Os interessados falam primeiro com a nossa equipe. Você não precisa expor seu telefone no anúncio público.</p></div></div><SellCarLeadForm /></section></>;
}
