import type { Metadata } from "next";

export const metadata: Metadata = { title: "Atacado" };

export default function AtacadoPage() {
  return (
    <section className="shell section" style={{ minHeight: "50vh" }}>
      <div className="page-hero" style={{ borderRadius: 18, marginBottom: 40 }}>
        <div className="shell">
          <p className="eyebrow">Atacado Dagoberto Easycar</p>
          <h1>Veículos no Atacado</h1>
          <p>Condições especiais para revendas e compradores de volume.</p>
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <h2>Entre em contato para negociações no atacado</h2>
        <p style={{ color: "#64748b", marginBottom: 20 }}>Temos condições diferenciadas para revendas e lojistas.</p>
        <a className="button" href="https://wa.me/5511934718276?text=Olá! Tenho interesse em veículos no atacado." target="_blank" rel="noreferrer">
          Falar pelo WhatsApp
        </a>
      </div>
    </section>
  );
}
