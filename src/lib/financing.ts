export type FinancingService = "partners" | "private";

export const FINANCING_SERVICES = {
  partners: {
    label: "Financiamento",
    originLabel: "Veículo de loja parceira",
    target: "site",
    href: "/financiamento",
    successHref: "/financiamento/sucesso",
  },
  private: {
    label: "Financia Fácil",
    originLabel: "Amigos, conhecidos ou negociação particular",
    target: "network",
    href: "/financia-facil",
    successHref: "/financia-facil/sucesso",
  },
} as const;

export function resolveFinancingService(service: unknown, target?: unknown): FinancingService | null {
  if (service === "partners" || service === "private") return service;
  if (service) return null;
  // Existing submissions used only the site/network target.
  return target === "site" ? "partners" : target === "network" ? "private" : null;
}

export function financingValidationError(body: Record<string, unknown>): string | null {
  if (!body.financingService) return null;
  const service = resolveFinancingService(body.financingService);
  if (!service || body.financingTarget !== FINANCING_SERVICES[service].target) {
    return "Selecione um serviço de financiamento válido.";
  }
  if (service === "partners" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.vehicleId ?? ""))) {
    return "Escolha um veículo de parceiro para continuar.";
  }
  if (service === "private" && (String(body.desiredVehicle ?? "").trim().length < 2 || body.vehicleId)) {
    return "Informe o veículo da negociação particular.";
  }
  return null;
}
