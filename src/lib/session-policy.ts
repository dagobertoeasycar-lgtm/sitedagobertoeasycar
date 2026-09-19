export const DEFAULT_SESSION_TIMEOUT_MINUTES = 8 * 60;
export const MIN_SESSION_TIMEOUT_MINUTES = 15;
export const MAX_SESSION_TIMEOUT_MINUTES = 7 * 24 * 60;

export function normalizeSessionTimeoutMinutes(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  return Math.min(MAX_SESSION_TIMEOUT_MINUTES, Math.max(MIN_SESSION_TIMEOUT_MINUTES, Math.round(parsed)));
}

export function formatSessionDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutos`;
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
