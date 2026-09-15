import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "Contato" };
export default function ContactPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Atendimento</p><h1>Fale com a Auto Drive Veículos.</h1><p>Telefone e WhatsApp: (11) 93471-8276.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Negociação fácil e rápida</h2><p>O atendimento acontece por WhatsApp e pelo formulário ao lado. Conte o que você procura — modelo, faixa de preço ou forma de pagamento — e a equipe já retorna com as opções disponíveis.</p><h2>Vários parceiros, vários modelos</h2><p>Trabalhamos com vários parceiros, então o estoque reúne vários modelos para todos os gostos. Se o carro que você quer não estiver anunciado hoje, avise: procuramos entre os parceiros.</p><h2>Canal oficial</h2><p><a href="tel:+5511934718276">(11) 93471-8276</a><br /><a href="https://wa.me/5511934718276" target="_blank" rel="noreferrer">Falar pelo WhatsApp</a></p></div><LeadForm kind="contact" title="Enviar mensagem" /></section></>;
}
