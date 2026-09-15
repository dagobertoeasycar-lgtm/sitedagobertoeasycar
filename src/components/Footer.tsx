import Link from "next/link";
import { ENDERECO, MAPS_ROTA_URL, WAZE_URL } from "@/lib/endereco";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        {/* Col 1: Logo + description */}
        <div>
          <img src="/brand/logo-footer.png" alt="Autodrive Veículos" className="footer-logo" />
          <p>Autodrive Veículos & Tecnologia: veículos próprios, parceiros e particulares em um só atendimento.</p>
        </div>

        {/* Col 2: Navegação */}
        <div>
          <strong>Navegação</strong>
          <Link href="/veiculos">Estoque</Link>
          <Link href="/encontre-seu-carro">Encontre seu carro</Link>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/financiamento">Financiamento</Link>
          <Link href="/parceiros">Seja parceiro</Link>
          <Link href="/sobre">Sobre</Link>
          <Link href="/contato">Contato</Link>
          <Link href="/admin/login">Acesso administrativo</Link>
        </div>

        {/* Col 3: Atendimento */}
        <div>
          <strong>Atendimento</strong>
          <a href="https://wa.me/5511934718276" target="_blank" rel="noreferrer" className="footer-phone">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .612.616l4.535-1.474A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.232-2.695.876.9-2.65-.254-.404A9.93 9.93 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            (11) 93471-8276
          </a>
          <a href={MAPS_ROTA_URL} target="_blank" rel="noreferrer" className="footer-address">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>{ENDERECO.linha1}<br/>{ENDERECO.complemento}</span>
          </a>
          <span className="footer-mapas">
            <a href={MAPS_ROTA_URL} target="_blank" rel="noreferrer">Google Maps</a>
            <a href={WAZE_URL} target="_blank" rel="noreferrer">Waze</a>
          </span>
          <ul className="footer-highlights">
            <li>Vários parceiros à sua disposição</li>
            <li>Vários modelos para todos os gostos</li>
            <li>Negociação fácil e rápida</li>
          </ul>
        </div>
      </div>

      {/* CTA section */}
      <div className="shell" style={{ marginTop: 32 }}>
        <div className="footer-cta">
          <strong>Não encontrou o carro certo?</strong>
          <p>A Autodrive procura opções na rede de parceiros e centraliza o atendimento.</p>
          <Link className="button" href="/encontre-seu-carro">Encontre meu carro</Link>
        </div>
      </div>

      <div className="shell footer-legal">
        <p>* Somos somente intermediadores. Garantia, laudo cautelar e procedência são de responsabilidade dos vendedores.</p>
      </div>

      <div className="shell footer-bottom">
        <span>&copy; {new Date().getFullYear()} Autodrive Veículos. Todos os direitos reservados.</span>
        <span><Link href="/privacidade">Privacidade</Link> &middot; <Link href="/termos">Termos</Link></span>
      </div>
    </footer>
  );
}
