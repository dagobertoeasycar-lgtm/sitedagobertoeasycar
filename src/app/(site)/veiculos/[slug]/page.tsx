import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { VehicleGallery } from "@/components/VehicleGallery";
import { findVehicle, money, listVehicles, vehicleOriginPublicLabel, vehiclePublicLocation } from "@/lib/vehicles";
import { VehicleCard } from "@/components/VehicleCard";
import { VehicleViewContent } from "@/components/MetaPixelEvents";
import { VehicleLeadActions } from "@/components/VehicleLeadForm";
import { readDefaultVehicleVideo } from "@/lib/default-vehicle-video";

export const dynamic = "force-dynamic";

function parseOptions(raw: unknown): string[] {
  let data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  if (!Array.isArray(data)) return [];
  return data.filter((x: unknown) => typeof x === "string");
}

function parseDescription(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(/\n+/).filter(p => p.trim());
}

/** Título e descrição próprios do anúncio (aba SEO do painel), com padrão automático. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await findVehicle(slug).catch(() => null);
  if (!vehicle) return {};
  const seo = await query<{ seo_title: string | null; seo_description: string | null }>(
    "select seo_title, seo_description from vehicles where slug=$1 limit 1",
    [slug],
  ).then((r) => r.rows[0]).catch(() => undefined);
  const automatic = [
    vehicle.title,
    vehicle.year_model ? `ano ${vehicle.year_make}/${vehicle.year_model}` : "",
    vehicle.mileage ? `${vehicle.mileage.toLocaleString("pt-BR")} km` : "",
    money(vehicle.price_cents),
  ].filter(Boolean).join(", ");
  const title = seo?.seo_title?.trim() || vehicle.title;
  const description = seo?.seo_description?.trim() || `${automatic}. Compra, financiamento e atendimento pela Autodrive Veículos.`;
  return {
    title,
    description,
    alternates: { canonical: `/veiculos/${slug}` },
    openGraph: { title, description, url: `/veiculos/${slug}`, images: vehicle.image_url ? [vehicle.image_url] : undefined },
  };
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await findVehicle(slug).catch(() => null);
  if (!vehicle) notFound();
  const originPublicLabel = vehicleOriginPublicLabel(vehicle);
  const publicLocation = vehiclePublicLocation(vehicle);
  const message = encodeURIComponent(`Olá! Vi o ${vehicle.title} (${vehicle.catalog_item_id}) no site da Autodrive e gostaria de mais informações.`);
  const options = parseOptions(vehicle.options);
  const descParagraphs = parseDescription(vehicle.description);
  const defaultVideo = await readDefaultVehicleVideo().catch(() => ({ effectiveUrl: "" }));
  const videoUrl = vehicle.video_url || defaultVideo.effectiveUrl;
  const pixelVehicle = {
    contentId: vehicle.catalog_item_id,
    name: vehicle.title,
    value: vehicle.price_cents / 100,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year_model || vehicle.year_make,
  };

  // Suggestions: same brand or similar price
  const suggestions = await listVehicles({ brand: vehicle.brand, page: 1 }).catch(() => []);
  const filtered = suggestions.filter(v => v.id !== vehicle.id).slice(0, 3);

  return (
    <>
      <VehicleViewContent vehicle={pixelVehicle} />
      <section className="shell section">
        {/* Gallery */}
        <VehicleGallery
          images={vehicle.images}
          title={vehicle.title}
          fallback={vehicle.image_url || "/em-breve.png"}
          videoUrl={videoUrl}
        />

        {/* Badges row */}
        <div className="detail-badges">
          {vehicle.featured && <div className="detail-badge"><span className="detail-badge-icon">⭐</span><span>Oportunidade</span></div>}
          <div className="detail-badge"><span className="detail-badge-icon">AD</span><span>{originPublicLabel}</span></div>
          <div className="detail-badge"><span className="detail-badge-icon">🔍</span><span>Periciado</span></div>
          {vehicle.promotion && <div className="detail-badge"><span className="detail-badge-icon">🏷️</span><span>Promoção</span></div>}
          <div className="detail-badge"><span className="detail-badge-icon">🔄</span><span>Aceita troca</span></div>
        </div>

        {/* Main content + sidebar */}
        <div className="detail-layout">
          <div className="detail-main">
            {/* Title + Price */}
            <div className="detail-header">
              <div>
                <h1 className="detail-title">{vehicle.brand} <span>{vehicle.model}</span></h1>
                <p className="detail-version">{vehicle.version}</p>
              </div>
              <div className="detail-price-box">
                {vehicle.old_price_cents && vehicle.old_price_cents > vehicle.price_cents && (
                  <span className="detail-old-price">de {money(vehicle.old_price_cents)}</span>
                )}
                <strong className="detail-price">{money(vehicle.price_cents)}</strong>
              </div>
            </div>

            {/* Ficha Técnica */}
            <div className="detail-section">
              <h2 className="detail-section-title">Ficha técnica</h2>
              <div className="detail-specs">
                <div className="detail-spec"><span className="detail-spec-icon">⚙️</span><span>{vehicle.transmission || "Consulte"}</span></div>
                <div className="detail-spec"><span className="detail-spec-icon">📅</span><span>{vehicle.year_make}/{vehicle.year_model}</span></div>
                <div className="detail-spec"><span className="detail-spec-icon">🛣️</span><span>{vehicle.mileage.toLocaleString("pt-BR")} km</span></div>
                {vehicle.color && <div className="detail-spec"><span className="detail-spec-icon">🎨</span><span>{vehicle.color}</span></div>}
                {vehicle.doors > 0 && <div className="detail-spec"><span className="detail-spec-icon">🚪</span><span>{vehicle.doors} portas</span></div>}
                <div className="detail-spec"><span className="detail-spec-icon">🚗</span><span>{vehicle.body_type || vehicle.fuel || "Consulte"}</span></div>
              </div>
            </div>

            {/* Opcionais */}
            {options.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section-title">Opcionais</h2>
                <div className="detail-options">
                  {options.map((opt, i) => <span key={i} className="detail-option">{opt}</span>)}
                </div>
              </div>
            )}

            {/* Periciado notice */}
            <div className="detail-notice">
              <strong>Todo estoque periciado</strong>
              <p>Até 2 anos de garantia. Consulte condições.</p>
            </div>

            {/* Descrição */}
            {descParagraphs.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-section-title">+ Informações</h2>
                <div className="detail-description">
                  {descParagraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="detail-sidebar">
            <VehicleLeadActions
              vehicle={{
                id: vehicle.id,
                title: vehicle.title,
                version: vehicle.version || "",
                price: money(vehicle.price_cents),
                image: vehicle.image_url || "",
                code: vehicle.catalog_item_id,
              }}
              whatsappHref={`https://wa.me/5511934718276?text=${message}`}
              phoneLabel="(11) 93471-8276"
              storeInfo={(
                <p className="detail-store-info">
                  <strong>{originPublicLabel}</strong>
                  <span>📍 {publicLocation}</span>
                  <small>O atendimento e o lead passam sempre pela Autodrive.</small>
                </p>
              )}
            />
          </aside>
        </div>
      </section>

      {/* Sugestões */}
      {filtered.length > 0 && (
        <section className="shell section">
          <div className="section-heading">
            <h2>Sugestões para você</h2>
            <Link href="/veiculos">Ver todos</Link>
          </div>
          <div className="vehicle-grid" style={{ gridTemplateColumns: `repeat(${Math.min(filtered.length, 3)}, minmax(0, 1fr))` }}>
            {filtered.map((v, i) => <VehicleCard key={v.id} vehicle={v} index={i} />)}
          </div>
        </section>
      )}
    </>
  );
}
