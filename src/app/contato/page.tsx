import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "Contato" };
export default function ContactPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Atendimento</p><h1>Fale com a Dagoberto Easycar.</h1><p>Telefone e WhatsApp: (11) 93471-8276.</p></div></section><section className="shell section content-grid"><div className="prose"><h2>Visite nossa loja</h2><p>Avenida dos Autonomistas, 5334<br />Km 18 — Osasco/SP<br />CEP 06194-060</p><h2>Canais oficiais</h2><p><a href="tel:+5511934718276">(11) 93471-8276</a><br /><a href="mailto:meucomercioonline5@gmail.com">meucomercioonline5@gmail.com</a></p><iframe title="Mapa da Dagoberto Easycar" src="https://www.google.com/maps?q=Avenida%20dos%20Autonomistas%205334%20Km%2018%20Osasco%20SP&output=embed" width="100%" height="320" loading="lazy" style={{ border: 0, borderRadius: 16 }} /></div><LeadForm kind="contact" title="Enviar mensagem" /></section></>;
}
