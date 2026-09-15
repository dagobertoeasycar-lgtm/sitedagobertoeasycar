import type { Metadata } from "next";
import { PartnerLeadForm } from "@/components/AutoDriveLeadForms";

export const metadata: Metadata = { title: "Parceiros" };

export default function AtacadoPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Parceiros Autodrive</p>
          <h1>Seu estoque pode gerar negócios através da nossa rede.</h1>
          <p>Cadastre sua empresa para divulgação, geração de leads, intermediação e financiamento.</p>
        </div>
      </section>
      <section className="shell section content-grid wholesale-page">
        <div className="prose">
          <h2>Parceria comercial</h2>
          <p>O cadastro vai diretamente para a equipe da Autodrive. A rota antiga de atacado foi mantida para não quebrar links já publicados.</p>
          <ul>
            <li>Divulgação do estoque.</li>
            <li>Geração e qualificação de leads.</li>
            <li>Intermediação com atendimento centralizado.</li>
            <li>Apoio para financiamento.</li>
          </ul>
          <div className="notice">
            <strong>Sem exposição direta</strong>
            <p>Os dados do parceiro ficam internos. O cliente fala primeiro com a Autodrive.</p>
          </div>
        </div>
        <PartnerLeadForm />
      </section>
    </>
  );
}
