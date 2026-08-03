import type { Metadata } from "next";
import { WholesaleLeadForm } from "@/components/WholesaleLeadForm";

export const metadata: Metadata = { title: "Atacado" };

export default function AtacadoPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Atacado Dagoberto Easycar</p>
          <h1>Veículos no atacado para lojistas e revendas.</h1>
          <p>Cadastre sua empresa para receber oportunidades e condições de negociação em volume.</p>
        </div>
      </section>
      <section className="shell section content-grid wholesale-page">
        <div className="prose">
          <h2>Atendimento empresarial</h2>
          <p>O cadastro vai diretamente para a equipe de atacado da Dagoberto Easycar.</p>
          <ul>
            <li>Oportunidades para lojistas e revendedores.</li>
            <li>Negociação direta com nossa equipe comercial.</li>
            <li>Retorno pelo telefone ou e-mail informado.</li>
          </ul>
          <div className="notice">
            <strong>Dados obrigatórios</strong>
            <p>Tenha em mãos o CNPJ, a razão social, o e-mail e o telefone da empresa.</p>
          </div>
        </div>
        <WholesaleLeadForm />
      </section>
    </>
  );
}
