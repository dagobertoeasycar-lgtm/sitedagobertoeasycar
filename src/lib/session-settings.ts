import { query } from "@/lib/db";
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  normalizeSessionTimeoutMinutes,
} from "@/lib/session-policy";

export {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  MAX_SESSION_TIMEOUT_MINUTES,
  MIN_SESSION_TIMEOUT_MINUTES,
  formatSessionDuration,
  normalizeSessionTimeoutMinutes,
} from "@/lib/session-policy";

export const SESSION_TIMEOUT_ENABLED_KEY = "admin_session_timeout_enabled";
export const SESSION_TIMEOUT_MINUTES_KEY = "admin_session_timeout_minutes";

export type SessionTimeoutSettings = {
  enabled: boolean;
  minutes: number;
};

export const defaultSessionTimeoutSettings: SessionTimeoutSettings = {
  enabled: true,
  minutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
};

export async function readSessionTimeoutSettings(): Promise<SessionTimeoutSettings> {
  const result = await query<{ key: string; value: string }>(
    "SELECT key,value FROM site_settings WHERE key = ANY($1::text[])",
    [[SESSION_TIMEOUT_ENABLED_KEY, SESSION_TIMEOUT_MINUTES_KEY]],
  );
  const values = new Map(result.rows.map((row) => [row.key, row.value]));
  return {
    enabled: values.get(SESSION_TIMEOUT_ENABLED_KEY) !== "false",
    minutes: normalizeSessionTimeoutMinutes(values.get(SESSION_TIMEOUT_MINUTES_KEY)),
  };
}

export async function writeSessionTimeoutSettings(settings: SessionTimeoutSettings) {
  const minutes = normalizeSessionTimeoutMinutes(settings.minutes);
  await query(
    `INSERT INTO site_settings(key,value,updated_at)
     VALUES ($1,$2,now()),($3,$4,now())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [
      SESSION_TIMEOUT_ENABLED_KEY,
      settings.enabled ? "true" : "false",
      SESSION_TIMEOUT_MINUTES_KEY,
      String(minutes),
    ],
  );
  return { enabled: settings.enabled, minutes };
}
