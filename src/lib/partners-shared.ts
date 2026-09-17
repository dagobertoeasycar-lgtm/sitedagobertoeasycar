/**
 * Tipos, constantes e funções puras de parceiro.
 *
 * Este arquivo NÃO importa o banco de propósito: ele é consumido por
 * componentes "use client", e qualquer caminho de import que chegue em
 * lib/db.ts arrasta o driver `pg` para o bundle do navegador — o que quebra
 * o build com "Module not found: Can't resolve 'dns'".
 *
 * Consulta ao banco fica em lib/partners.ts, que é só de servidor.
 */

export type PartnerOriginKind = "PARTNER" | "PRIVATE" | "OWN";

/** Adaptadores que sabem ler o estoque de cada plataforma. */
export type PartnerConnector = "autoconf" | "bndv_next" | "bndv_html" | "guiotti_rsc";

export const PARTNER_CONNECTORS: { value: PartnerConnector; label: string; hint: string }[] = [
  { value: "autoconf", label: "Autoconf (API /api/stock)", hint: "Plataforma expõe o estoque em JSON. Ex.: EasyCar, Tchesco Car." },
  { value: "bndv_next", label: "BNDV em Next.js", hint: "Dados vêm dentro da própria página de listagem. Ex.: Justo Car." },
  { value: "bndv_html", label: "BNDV em site próprio (HTML)", hint: "Sem API: lê a listagem e visita cada anúncio. Ex.: Now Car." },
  { value: "guiotti_rsc", label: "Supabase / Next app router", hint: "Dados no payload da página. Ex.: Guiotti Multimarcas." },
];

export const VEHICLE_FILTERS = [
  { value: "cars", label: "Somente carros" },
  { value: "all", label: "Tudo, inclusive moto" },
] as const;

export const PARTNER_ORIGIN_KINDS: { value: PartnerOriginKind; label: string }[] = [
  { value: "PARTNER", label: "Loja parceira" },
  { value: "PRIVATE", label: "Venda particular" },
  { value: "OWN", label: "Estoque próprio" },
];

export type ConnectorConfig = {
  baseUrl?: string;
  listPath?: string;
  detailPath?: string;
  pageParam?: string;
  startPage?: number;
  maxPages?: number;
  perPage?: number;
  fetchDetails?: boolean;
  vehicleFilter?: string;
};

export type Partner = {
  id: string;
  source_id: string;
  external_id: string;
  name: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string;
  stock_url: string | null;
  stock_url_alt: string | null;
  origin_kind: PartnerOriginKind;
  notes: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  last_sync_at: Date | null;
  last_found: number;
  last_imported: number;
  last_changed: number;
  last_removed: number;
  sync_source_id: string | null;
  connector: PartnerConnector | null;
  connector_config: ConnectorConfig;
  last_error: string | null;
  last_error_at: Date | null;
  vehicles_total?: number;
  vehicles_published?: number;
};

export type PartnerInput = {
  name: string;
  tradeName?: string;
  legalName?: string;
  cnpj?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  stockUrl?: string;
  stockUrlAlt?: string;
  originKind?: string;
  notes?: string;
  active?: boolean;
  connector?: string | null;
  baseUrl?: string;
  vehicleFilter?: string;
};

export function normalizePartnerOriginKind(value?: string | null): PartnerOriginKind {
  return value === "PRIVATE" || value === "OWN" ? value : "PARTNER";
}

export function normalizePartnerConnector(value?: string | null): PartnerConnector | null {
  return PARTNER_CONNECTORS.some((c) => c.value === value) ? (value as PartnerConnector) : null;
}

/** Só dígitos, para comparar e montar link de WhatsApp. */
export function digitsOnly(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function whatsappLink(value?: string | null) {
  const digits = digitsOnly(value);
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

/**
 * Monta o connector_config preservando os ajustes finos que a migration
 * semeou (listPath, pageParam, startPage…) e sobrescrevendo só o que a tela
 * edita. Evita que salvar o cadastro zere a configuração do adaptador.
 */
export function mergeConnectorConfig(atual: ConnectorConfig | null | undefined, input: PartnerInput): ConnectorConfig {
  const base = { ...(atual && typeof atual === "object" ? atual : {}) };
  const url = String(input.baseUrl ?? "").trim();
  if (url) base.baseUrl = url.replace(/\/+$/, "");
  const filtro = String(input.vehicleFilter ?? "").trim();
  if (filtro === "cars" || filtro === "all") base.vehicleFilter = filtro;
  return base;
}

export function validatePartnerInput(input: PartnerInput) {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) return "Informe o nome do parceiro.";

  const connector = String(input.connector ?? "").trim();
  if (connector && !normalizePartnerConnector(connector)) return "Conector inválido.";
  if (connector && !String(input.baseUrl ?? "").trim()) {
    return "Para sincronizar automaticamente, informe o endereço base do site do parceiro.";
  }

  for (const [label, value] of [
    ["URL do estoque", input.stockUrl],
    ["URL alternativa", input.stockUrlAlt],
    ["Endereço base", input.baseUrl],
  ] as const) {
    const url = String(value ?? "").trim();
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return `${label} precisa começar com http ou https.`;
    } catch {
      return `${label} não é um endereço válido.`;
    }
  }
  return null;
}
