import Link from "next/link";

const MAPS_URL = "https://www.google.com/maps/dir/?api=1&destination=Easycar+Matriz+Avenida+dos+Autonomistas+5334+Osasco+SP";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        {/* Col 1: Logo + description + social */}
        <div>
          <img src="/brand/logo-footer.png" alt="Dagoberto Easycar Veículos" className="footer-logo" />
          <p>Veículos periciados, com procedência. Tradição, transparência e dedicação.</p>
          <div className="footer-social">
            <a href="https://www.instagram.com/easycarveiculos" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://www.facebook.com/easycarveiculos" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385h-3.047v-3.47h3.047v-2.642c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385c5.737-.9 10.125-5.864 10.125-11.854z"/></svg>
            </a>
            <a href="https://www.youtube.com/channel/UCGa59ynGDtgH3jbwmaekaCw" target="_blank" rel="noreferrer" aria-label="YouTube" title="YouTube">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
        </div>

        {/* Col 2: Navegação */}
        <div>
          <strong>Navegação</strong>
          <Link href="/veiculos">Veículos</Link>
          <Link href="/financiamento">Financiamento</Link>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/admin/login">Acesso administrativo</Link>
        </div>

        {/* Col 3: Endereço + Mapa */}
        <div>
          <strong>Easycar — Matriz</strong>
          <a href={MAPS_URL} target="_blank" rel="noreferrer" className="footer-address">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Av. dos Autonomistas, 5334<br/>Centro — Osasco/SP<br/>CEP 06194-060</span>
          </a>
          <a href="tel:+551147502994" className="footer-phone">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            (11) 4750-2994
          </a>
          <a href="https://wa.me/5511934718276" target="_blank" rel="noreferrer" className="footer-phone">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .612.616l4.535-1.474A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.232-2.695.876.9-2.65-.254-.404A9.93 9.93 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            (11) 93471-8276
          </a>
          {/* Google Maps embed - Matriz only */}
          <div className="footer-map">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.5!2d-46.7917!3d-23.5325!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ceff5a9bce4095%3A0x5e5e6e6e6e6e6e6e!2sAv.+dos+Autonomistas%2C+5334+-+Centro%2C+Osasco+-+SP!5e0!3m2!1spt-BR!2sbr!4v1700000000000"
              width="100%" height="150" style={{ border: 0, borderRadius: 10 }} allowFullScreen loading="lazy"
              referrerPolicy="no-referrer-when-downgrade" title="Localização Easycar Matriz"
            />
          </div>
          <a href={MAPS_URL} target="_blank" rel="noreferrer" className="button button-small" style={{ width: "100%", marginTop: 8 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Traçar rota até aqui
          </a>
        </div>
      </div>

      {/* CTA section */}
      <div className="shell" style={{ marginTop: 32 }}>
        <div className="footer-cta">
          <strong>Encontre seu carro ideal</strong>
          <p>Estoque atualizado com veículos periciados e financiamento facilitado.</p>
          <a className="button" href="https://wa.me/5511934718276?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20ve%C3%ADculos%20dispon%C3%ADveis." target="_blank" rel="noreferrer">
            Fale conosco pelo WhatsApp
          </a>
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>&copy; {new Date().getFullYear()} Dagoberto Easycar Veículos — Matriz. Todos os direitos reservados.</span>
        <span><Link href="/privacidade">Privacidade</Link> &middot; <Link href="/termos">Termos</Link></span>
      </div>
    </footer>
  );
}
