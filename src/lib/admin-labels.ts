/** Rótulos e formatações compartilhados pelas telas do painel. */

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  paused: "Pausado",
  sold: "Vendido",
};

export const STOCK_STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
};

export const ORIGIN_LABELS: Record<string, string> = {
  OWN: "Estoque próprio",
  PARTNER: "Parceiro",
  PRIVATE: "Particular",
};

export const LEAD_KIND_LABELS: Record<string, string> = {
  contact: "Contato",
  financing: "Financiamento",
  sell_car: "Venda de veículo",
  wholesale: "Atacado",
  partner: "Parceiro",
  find_car: "Autodrive Busca",
  vehicle_interest: "Interesse em veículo",
};

// Os códigos internos continuam os mesmos (relatórios usam converted/lost);
// só os nomes seguem as etapas do CRM.
export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Aguardando atendimento",
  scheduled: "Visita agendada",
  contacted: "Em atendimento",
  qualified: "Em atendimento (qualificado)",
  converted: "Sucesso",
  lost: "Insucesso",
  archived: "Arquivado",
};

/** Colunas do quadro do CRM, na ordem do funil. */
export const CRM_STAGES = [
  { id: "new", label: "Aguardando atendimento", tone: "amber" },
  { id: "scheduled", label: "Visita agendada", tone: "blue" },
  { id: "contacted", label: "Em atendimento", tone: "teal" },
  { id: "converted", label: "Sucesso", tone: "green" },
  { id: "lost", label: "Insucesso", tone: "red" },
] as const;

/** Status antigos que aparecem numa coluna do quadro. */
export function crmStageOf(status: string) {
  return status === "qualified" ? "contacted" : status;
}

export const LOST_REASONS = [
  "Comprou em outro lugar",
  "Crédito reprovado",
  "Preço / condição",
  "Desistiu da compra",
  "Não respondeu",
  "Carro vendido",
  "Avaliação da troca",
  "Outro",
];

export const SUGGESTED_TAGS = ["Quente", "Morno", "Frio", "Financiamento", "À vista", "Com troca", "Retornar", "VIP"];

/** Status mostrado no badge: promoção tem destaque próprio, como no protótipo. */
export function vehicleBadge(status: string, stockStatus: string, promotion: boolean) {
  if (status === "published" && stockStatus === "reserved") return { cls: "reserved", label: "Reservado" };
  if (status === "published" && promotion) return { cls: "promotion", label: "Promoção" };
  return { cls: status, label: VEHICLE_STATUS_LABELS[status] ?? status };
}

export function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function km(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR");
}

export function shortTime(date: Date | string) {
  const value = new Date(date);
  const tz = "America/Sao_Paulo";
  const sameDay = value.toLocaleDateString("pt-BR", { timeZone: tz }) === new Date().toLocaleDateString("pt-BR", { timeZone: tz });
  return sameDay
    ? value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz })
    : value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz });
}
