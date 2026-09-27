import Link from "next/link";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { ENDERECO, MAPS_ROTA_URL, WAZE_URL } from "@/lib/endereco";
import { CIDADES, listBrandLandings } from "@/lib/seo-landings";

const WHATSAPP = "https://wa.me/5511934718276";

const NAV = [
  { href: "/veiculos", label: "Estoque" },
  { href: "/encontre-seu-carro", label: "Encontre seu carro" },
  { href: "/venda-seu-carro", label: "Venda seu carro" },
  { href: "/financiamento", label: "Financiamento" },
  { href: "/financia-facil", label: "Financia Fácil" },
  { href: "/parceiros", label: "Seja parceiro" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

// Rodapé padrão (o mesmo do site das lojas no SaaS, SiteFooter): faixa de
// chamada com WhatsApp, 4 colunas (marca, navegação, atendimento, "procure por"
// em etiquetas), aviso legal e barra final.
export async function Footer() {
  // Links por marca e por cidade: ajudam o Google a achar o estoque e levam
  // quem procura "carros em Osasco" direto para uma página com conteúdo.
  const marcas = await listBrandLandings(6).then((list) => list.slice(0, 8)).catch(() => []);
  const tags = [
    ...marcas.map((m) => ({ href: `/carros/${m.slug}`, label: `${m.nome} seminovos` })),
    ...CIDADES.map((c) => ({ href: `/carros-em/${c.slug}`, label: `Carros em ${c.nome}` })),
  ];
  return (
    <footer className="site-footer">
      <div className="shell footer-cta">
        <div>
          <strong>Não encontrou o carro certo?</strong>
          <p>A Autodrive procura opções na rede de parceiros e centraliza o atendimento.</p>
        </div>
        <a className="button" href={WHATSAPP} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" />Falar pelo WhatsApp</a>
      </div>

      <div className="shell footer-grid">
        <div className="footer-brand">
          <span className="footer-logo-plain"><img src="/brand/autodrive-logo-footer.png" alt="Autodrive Veículos" className="footer-logo" width={718} height={114} /></span>
          <p>Veículos próprios, parceiros e particulares em um só atendimento.</p>
        </div>

        <nav className="footer-col" aria-label="Rodapé">
          <strong>Navegação</strong>
          <div className="footer-links two-cols">{NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}</div>
        </nav>

        <div className="footer-col">
          <strong>Atendimento</strong>
          <ul className="footer-contact">
            <li><MessageCircle size={16} aria-hidden="true" /><a href={WHATSAPP} target="_blank" rel="noreferrer">(11) 93471-8276</a></li>
            <li><MapPin size={16} aria-hidden="true" /><span>{ENDERECO.linha1}<br />{ENDERECO.linha2}</span></li>
            <li><Clock size={16} aria-hidden="true" /><span>{ENDERECO.observacao}</span></li>
          </ul>
          <div className="footer-mapas">
            <a href={MAPS_ROTA_URL} target="_blank" rel="noreferrer">Google Maps</a>
            <a href={WAZE_URL} target="_blank" rel="noreferrer">Waze</a>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="footer-col">
            <strong>Procure por</strong>
            <div className="footer-tags">{tags.map((t) => <Link key={t.href} href={t.href}>{t.label}</Link>)}</div>
          </div>
        )}
      </div>

      <div className="shell footer-legal">
        <p>* Somos somente intermediadores. Garantia, laudo cautelar e procedência são de responsabilidade dos vendedores.</p>
      </div>

      <div className="shell footer-bottom">
        <span>&copy; {new Date().getFullYear()} Autodrive Veículos. Todos os direitos reservados.</span>
        <span className="footer-legal-links">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
          <Link href="/admin/login">Acesso administrativo</Link>
        </span>
      </div>
    </footer>
  );
}
