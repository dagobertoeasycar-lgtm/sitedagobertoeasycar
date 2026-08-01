import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sobre nós" };
export default function AboutPage() {
  return <><section className="page-hero"><div className="shell"><p className="eyebrow">Dagoberto Easycar</p><h1>Tradição, transparência e dedicação.</h1><p>Diversas marcas e modelos, qualidade e procedência.</p></div></section><section className="shell section prose"><h2>Atendimento do começo ao pós-venda</h2><p>Nosso trabalho combina curadoria de veículos, avaliação transparente, apoio na aprovação de crédito online e acompanhamento depois da compra.</p><h2>Procedência em primeiro lugar</h2><p>Os veículos anunciados passam por verificação e têm suas informações apresentadas de forma clara. Consulte a equipe para detalhes de laudo, documentação e disponibilidade.</p><h2>Onde estamos</h2><p>Avenida dos Autonomistas, 5334, Km 18, Osasco/SP, CEP 06194-060.</p></section></>;
}
