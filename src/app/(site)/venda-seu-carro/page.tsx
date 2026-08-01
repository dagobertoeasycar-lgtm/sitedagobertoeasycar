import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "Venda seu carro" };
export default function SellCarPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Avaliação</p><h1>Venda ou use seu carro na troca.</h1><p>Informe marca, modelo, ano, quilometragem e preço pretendido para receber uma avaliação inicial.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Como funciona</h2><ol><li>Você envia as informações iniciais.</li><li>Nossa equipe entra em contato para entender o veículo.</li><li>Agendamos a avaliação presencial.</li><li>Apresentamos a proposta sem compromisso.</li></ol><p>A avaliação final depende de inspeção presencial e análise documental.</p></div><LeadForm kind="sell_car" title="Quero avaliar meu carro" /></section></>;
}
