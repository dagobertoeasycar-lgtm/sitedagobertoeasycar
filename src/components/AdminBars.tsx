export type BarItem = { label: string; total: number };

/** Gráfico de barras horizontal simples, sem biblioteca, para o painel. */
export function AdminBars({ items, format, wide }: { items: BarItem[]; format?: (value: number) => string; wide?: boolean }) {
  const max = Math.max(1, ...items.map((item) => item.total));
  if (!items.length) return <p className="ad-note">Sem dados ainda.</p>;
  return (
    <ul className={wide ? "ad-bars wide" : "ad-bars"}>
      {items.map((item) => (
        <li key={item.label}>
          <span title={item.label}>{item.label}</span>
          <span className="bar"><i style={{ width: `${(item.total / max) * 100}%` }} /></span>
          <b>{format ? format(item.total) : item.total.toLocaleString("pt-BR")}</b>
        </li>
      ))}
    </ul>
  );
}
