import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";
import { ENDERECO, MAPS_ROTA_URL, WAZE_URL, MAPS_EMBED_URL } from "@/lib/endereco";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a Autodrive pelo WhatsApp oficial para comprar, vender, financiar ou encontrar um veículo.",
};
export default function ContactPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Atendimento</p><h1>Fale com a Autodrive.</h1><p>Telefone e WhatsApp: (11) 93471-8276.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Negociação fácil e rápida</h2><p>O atendimento acontece por WhatsApp e pelo formulário ao lado. Conte se você quer comprar, vender, financiar ou encontrar um veículo, e a equipe retorna com os próximos passos.</p><h2>Vários parceiros, vários modelos</h2><p>Trabalhamos com veículos próprios, parceiros e particulares intermediados. Se o carro que você quer não estiver anunciado hoje, avise: a Autodrive procura na rede.</p><h2>Canal oficial</h2><p><a href="tel:+5511934718276">(11) 93471-8276</a><br /><a href="https://wa.me/5511934718276?text=Olá!%20Vim%20pelo%20site%20da%20Autodrive%20e%20gostaria%20de%20atendimento." target="_blank" rel="noreferrer">Falar pelo WhatsApp</a></p><h2>Escritório</h2><p>{ENDERECO.linha1}<br />{ENDERECO.linha2}</p><p className="mapa-acoes"><a className="button button-small" href={MAPS_ROTA_URL} target="_blank" rel="noreferrer">Como chegar (Google Maps)</a><a className="button button-small button-outline" href={WAZE_URL} target="_blank" rel="noreferrer">Abrir no Waze</a></p><iframe className="mapa-embutido" title="Mapa do escritório da Autodrive em Barueri" src={MAPS_EMBED_URL} width="100%" height="300" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><p className="legal-note">Escritório comercial: atendimento presencial mediante agendamento pelo WhatsApp. Os veículos podem ficar em estoque próprio, parceiros ou particulares intermediados.</p></div><LeadForm kind="contact" title="Enviar mensagem" /></section></>;
}
