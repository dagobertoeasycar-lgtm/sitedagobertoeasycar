/**
 * Parte pura das permissões (sem banco), usada também pelo menu no navegador.
 * A checagem de verdade acontece no servidor, em permissions.ts.
 */
/*
 * Perfis do painel (RBAC) e as áreas que cada um acessa.
 *
 * A sessão só guarda o id do usuário; perfil e situação (ativo) são lidos do
 * banco a cada requisição. Assim, desativar alguém ou trocar o perfil vale
 * na hora, sem esperar o cookie expirar.
 */
export const ROLES = {
  admin: "Administrador",
  editor: "Editor de anúncios",
  marketing: "Marketing",
  comercial: "Comercial",
} as const;
export type Role = keyof typeof ROLES;

export const AREAS = {
  dashboard: "Dashboard",
  veiculos: "Anúncios, estoque e fotos",
  banners: "Banners, promoções e depoimentos",
  leads: "Leads, financiamentos e atacado",
  importacoes: "Importações e fontes",
  meta: "Catálogo Meta",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  usuarios: "Usuários e permissões",
  auditoria: "Auditoria",
} as const;
export type Area = keyof typeof AREAS;

export const ROLE_AREAS: Record<Role, Area[]> = {
  admin: Object.keys(AREAS) as Area[],
  editor: ["dashboard", "veiculos", "importacoes", "meta"],
  marketing: ["dashboard", "veiculos", "banners", "meta", "relatorios"],
  comercial: ["dashboard", "veiculos", "leads", "relatorios"],
};

export function canAccess(role: string | null | undefined, area: Area) {
  return Boolean(role && role in ROLE_AREAS && ROLE_AREAS[role as Role].includes(area));
}
