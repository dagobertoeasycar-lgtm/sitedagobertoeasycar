import type { Metadata } from "next";
import { PartnerLeadForm } from "@/components/AutoDriveLeadForms";

export const metadata: Metadata = {
  title: "Parceiros",
  description: "Cadastro de lojistas parceiros para divulgação de estoque, geração de leads, intermediação e financiamento com a Autodrive.",
};

export default function PartnersPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">Rede de parceiros</p>
          <h1>Seja um parceiro Autodrive</h1>
          <p>Seu estoque pode gerar negócios através da nossa rede.</p>
        </div>
      </section>
      <section className="shell section content-grid">
        <div className="prose">
          <h2>Parceria para lojistas</h2>
          <p>A Autodrive conecta compradores, lojistas parceiros, particulares e financiamento em um só atendimento comercial.</p>
          <ul>
            <li>Divulgação do estoque em uma vitrine preparada para conversão.</li>
            <li>Geração de leads com origem identificada.</li>
            <li>Atendimento comercial antes do repasse da oportunidade.</li>
            <li>Apoio para financiamento e análise de perfil do comprador.</li>
            <li>Expansão da exposição sem abrir mão do controle interno.</li>
            <li>Tecnologia preparada para gestão automotiva.</li>
          </ul>
          <div className="notice"><strong>Dados protegidos</strong><p>O nome e o contato direto do parceiro não aparecem publicamente nos anúncios. O lead entra primeiro pela Autodrive.</p></div>
        </div>
        <PartnerLeadForm />
      </section>
    </>
  );
}
