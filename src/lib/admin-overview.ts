import { query } from "@/lib/db";

/**
 * Números da barra superior e dos cards do painel. Cada consulta falha de
 * forma isolada: se uma tabela ainda não existir (migration pendente), o card
 * mostra zero em vez de derrubar todas as páginas do admin.
 */
export type AdminOverview = {
  syncEnabled: boolean;
  lastSync: Date | null;
  pending: number;
  newLeads: number;
  published: number;
  publishedToday: number;
  featured: number;
  leadsToday: number;
  leadsYesterday: number;
  banners: number;
  sources: number;
  sourcesOnline: number;
  sourceErrors: number;
};

const empty: AdminOverview = {
  syncEnabled: false,
  lastSync: null,
  pending: 0,
  newLeads: 0,
  published: 0,
  publishedToday: 0,
  featured: 0,
  leadsToday: 0,
  leadsYesterday: 0,
  banners: 0,
  sources: 0,
  sourcesOnline: 0,
  sourceErrors: 0,
};

async function one<T>(sql: string): Promise<T | null> {
  try {
    return (await query<T & Record<string, unknown>>(sql)).rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [vehicles, leads, banners, sources, sync] = await Promise.all([
    one<{ published: number; published_today: number; featured: number; pending: number }>(`select
      count(*) filter (where status='published')::int as published,
      count(*) filter (where status='published' and created_at >= current_date)::int as published_today,
      count(*) filter (where status='published' and featured)::int as featured,
      count(*) filter (where status='draft')::int as pending
      from vehicles`),
    one<{ today: number; yesterday: number; fresh: number }>(`select
      count(*) filter (where created_at >= current_date)::int as today,
      count(*) filter (where created_at >= current_date - 1 and created_at < current_date)::int as yesterday,
      count(*) filter (where status='new')::int as fresh
      from leads`),
    one<{ active: number }>("select count(*)::int as active from banners where active"),
    one<{ total: number; online: number; errors: number }>(`select
      count(*)::int as total,
      count(*) filter (where last_error is null)::int as online,
      count(*) filter (where last_error is not null)::int as errors
      from partners where active and connector is not null`),
    one<{ enabled: string | null; last: Date | null }>(`select
      (select value from sync_config where key='easycar_enabled') as enabled,
      (select max(finished_at) from sync_runs) as last`),
  ]);

  return {
    ...empty,
    syncEnabled: sync ? sync.enabled !== "false" : false,
    lastSync: sync?.last ?? null,
    pending: vehicles?.pending ?? 0,
    newLeads: leads?.fresh ?? 0,
    published: vehicles?.published ?? 0,
    publishedToday: vehicles?.published_today ?? 0,
    featured: vehicles?.featured ?? 0,
    leadsToday: leads?.today ?? 0,
    leadsYesterday: leads?.yesterday ?? 0,
    banners: banners?.active ?? 0,
    sources: sources?.total ?? 0,
    sourcesOnline: sources?.online ?? 0,
    sourceErrors: sources?.errors ?? 0,
  };
}
