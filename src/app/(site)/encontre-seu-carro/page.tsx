import type { Metadata } from "next";
import { FindCarLeadForm } from "@/components/AutoDriveLeadForms";

export const metadata: Metadata = {
  title: "Encontre seu carro",
  description: "Conte para a Autodrive qual carro você procura e nossa equipe busca opções na rede de parceiros.",
};

export default function FindCarPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Autodrive Busca</p>
          <h1>Não encontrou o carro que procura?</h1>
          <p>Conte para a Autodrive. Nós procuramos em nossa rede de parceiros.</p>
        </div>
      </section>
      <section className="shell section content-grid">
        <div className="prose">
          <h2>Mais opções. Um só atendimento.</h2>
          <p>Você não precisa procurar loja por loja. Nossa equipe recebe o seu perfil de busca, consulta a rede e retorna com opções compatíveis.</p>
          <ul>
            <li>Busca por marca, modelo, orçamento e forma de pagamento.</li>
            <li>Possibilidade de troca e financiamento no mesmo atendimento.</li>
            <li>Contato pelo WhatsApp oficial da Autodrive.</li>
          </ul>
          <div className="notice"><strong>Busca direcionada</strong><p>Quanto mais claro for o seu orçamento e preferência, mais rápido conseguimos filtrar boas oportunidades.</p></div>
        </div>
        <FindCarLeadForm />
      </section>
    </>
  );
}
