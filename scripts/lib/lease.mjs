/**
 * Trava de execução por tempo (lease), guardada em sync_config.
 *
 * Substitui pg_advisory_lock: o DATABASE_URL aponta para o pooler do Neon, e
 * lá a trava de sessão pode ficar presa numa conexão reaproveitada por outro
 * cliente. Foi o que aconteceu em 24/09/2026: uma trava do sync ficou pendurada
 * numa conexão ociosa do site e a sincronização da nuvem parou de rodar,
 * dizendo "sincronização anterior ainda em andamento".
 *
 * A trava por tempo não depende da conexão: se o processo morrer, ela vence
 * sozinha depois de `minutos`.
 */
export async function adquirirTrava(client, chave, minutos = 20) {
  const r = await client.query(
    `insert into sync_config(key, value, updated_at) values($1, now()::text, now())
     on conflict (key) do update set value = now()::text, updated_at = now()
     where sync_config.updated_at < now() - ($2 || ' minutes')::interval
     returning key`,
    [chave, String(minutos)],
  );
  return (r.rowCount || 0) > 0;
}

export async function liberarTrava(client, chave) {
  await client
    .query("update sync_config set updated_at = now() - interval '1 year' where key = $1", [chave])
    .catch(() => undefined);
}
