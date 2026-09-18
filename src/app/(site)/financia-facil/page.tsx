import type { Metadata } from "next";
import Link from "next/link";
import { FinancingForm } from "@/components/FinancingForm";

export const metadata: Metadata = {
  title: "Financia Fácil",
  description: "Financie o carro de um amigo, conhecido ou uma negociação particular com o Financia Fácil Autodrive. Crédito sujeito à análise.",
};

export default function PrivateFinancingPage() {
  return (
    <>
      <section className="page-hero"><div className="shell">
        <p className="eyebrow">Negociações particulares · Autodrive</p>
        <h1>Financia Fácil</h1>
        <p>Encontrou o carro de um amigo ou conhecido? Nós conectamos sua negociação particular às opções de financiamento das instituições financeiras.</p>
      </div></section>
      <section className="shell section content-grid">
        <div className="prose">
          <h2>O carro é de um particular. O atendimento é Autodrive.</h2>
          <p>Não precisa ser um veículo anunciado no nosso site. Informe o carro que você está negociando e nossa equipe orienta a simulação e os próximos passos com as financeiras.</p>
          <ul>
            <li>Compra de amigos, conhecidos ou outros particulares.</li>
            <li>Orientação sobre as informações e documentos necessários.</li>
            <li>Contato humano para acompanhar sua solicitação.</li>
            <li>Sem envio de CPF ou documentos nesta primeira etapa.</li>
          </ul>
          <div className="notice"><strong>Crédito responsável</strong><p>Crédito sujeito à análise e aprovação da instituição financeira, incluindo elegibilidade do veículo e condições da negociação. O envio da solicitação não garante aprovação.</p></div>
          <div className="finance-service-alternative">
            <h3>Escolheu um carro de loja parceira?</h3>
            <p>A simulação dos veículos da nossa rede de lojas tem um atendimento próprio.</p>
            <Link href="/financiamento" className="button button-outline">Ir para Financiamento</Link>
          </div>
        </div>
        <FinancingForm vehicles={[]} service="private" />
      </section>
    </>
  );
}
