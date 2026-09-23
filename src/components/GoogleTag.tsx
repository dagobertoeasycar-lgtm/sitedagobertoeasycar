import Script from "next/script";

/**
 * Tag do Google (Google Ads / gtag.js). O ID vem do ambiente quando existir;
 * o padrão é a conta de anúncios da Autodrive. Só uma tag do Google por
 * página, como a documentação exige.
 *
 * Os hosts do Google precisam estar liberados na CSP em next.config.ts.
 */
const DEFAULT_ID = "AW-18468438331";

export function GoogleTag() {
  const id = (process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || DEFAULT_ID).trim();
  if (!/^(AW|G|GT|DC)-[A-Za-z0-9-]+$/.test(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
