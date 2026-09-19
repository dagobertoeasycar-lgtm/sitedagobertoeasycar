import { query } from "@/lib/db";

export const DEFAULT_VEHICLE_VIDEO_URL_KEY = "default_vehicle_video_url";
export const DEFAULT_VEHICLE_VIDEO_ENABLED_KEY = "default_vehicle_video_enabled";

export type DefaultVehicleVideo = {
  url: string;
  enabled: boolean;
  effectiveUrl: string;
};

export async function readDefaultVehicleVideo(): Promise<DefaultVehicleVideo> {
  const result = await query<{ key: string; value: string }>(
    "SELECT key,value FROM site_settings WHERE key = ANY($1::text[])",
    [[DEFAULT_VEHICLE_VIDEO_URL_KEY, DEFAULT_VEHICLE_VIDEO_ENABLED_KEY]],
  );
  const values = new Map(result.rows.map((row) => [row.key, row.value]));
  const url = values.get(DEFAULT_VEHICLE_VIDEO_URL_KEY)?.trim() || "";
  const enabled = Boolean(url) && values.get(DEFAULT_VEHICLE_VIDEO_ENABLED_KEY) === "true";
  return { url, enabled, effectiveUrl: enabled ? url : "" };
}

export async function writeDefaultVehicleVideo(url: string, enabled: boolean) {
  await query(
    `INSERT INTO site_settings(key,value,updated_at)
     VALUES ($1,$2,now()),($3,$4,now())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [
      DEFAULT_VEHICLE_VIDEO_URL_KEY,
      url,
      DEFAULT_VEHICLE_VIDEO_ENABLED_KEY,
      enabled && Boolean(url) ? "true" : "false",
    ],
  );
}

export async function setDefaultVehicleVideoEnabled(enabled: boolean) {
  await query(
    `INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,now())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [DEFAULT_VEHICLE_VIDEO_ENABLED_KEY, enabled ? "true" : "false"],
  );
}
