import { requireArea } from "@/lib/permissions";
import Link from "next/link";
import { DefaultVehicleVideo } from "@/components/DefaultVehicleVideo";
import { SessionTimeoutSettings } from "@/components/SessionTimeoutSettings";
import { ReviewLinkForm } from "@/components/ReviewLinkForm";
import { getAdsConversions, getReviewLink } from "@/lib/settings";
import { GoogleAdsForm } from "@/components/GoogleAdsForm";
import { EMPTY_ADS_CONVERSIONS } from "@/lib/ads-conversions";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  await requireArea("configuracoes");
  const reviewLink = await getReviewLink().catch(() => "");
  const adsConversions = await getAdsConversions().catch(() => EMPTY_ADS_CONVERSIONS);

  return (
    <>
      <div className="adm-header"><h1>Configurações</h1></div>
      <div className="adm-grid-2">
        <Link className="adm-card config-link-card" href="/admin/configuracoes/emails">
          <span className="config-link-icon">✉️</span><div><h2>E-mails e notificações</h2><p>SMTP, e-mail “não responda”, quem recebe os leads e confirmação automática para o cliente.</p></div>
        </Link>
        <Link className="adm-card config-link-card" href="/admin/configuracoes/integracoes/meta">
          <span className="config-link-icon">🛒</span><div><h2>Integrações → Catálogo Meta</h2><p>Feed automático do estoque para o catálogo conectado ao WhatsApp Business.</p></div>
        </Link>
        <Link className="adm-card config-link-card" href="/admin/configuracoes/precificacao">
          <span className="config-link-icon">💰</span><div><h2>Regra de preço</h2><p>Acréscimo comercial entre o preço do parceiro e o preço publicado, com margem de negociação.</p></div>
        </Link>
        <Link className="adm-card config-link-card" href="/admin/parceiros">
          <span className="config-link-icon">🤝</span><div><h2>Parceiros</h2><p>Cadastro, ativação e desativação das lojas parceiras que alimentam o estoque.</p></div>
        </Link>
        <Link className="adm-card config-link-card" href="/admin/trocar-senha">
          <span className="config-link-icon">🔐</span><div><h2>Trocar senha</h2><p>Atualize com segurança a senha da sua conta administrativa.</p></div>
        </Link>
      </div>
      <ReviewLinkForm initialUrl={reviewLink} />
      <GoogleAdsForm initial={adsConversions} />
      <SessionTimeoutSettings />
      <DefaultVehicleVideo />
    </>
  );
}
