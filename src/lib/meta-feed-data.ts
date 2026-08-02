import { query } from "@/lib/db";
import {
  buildMetaFeed,
  DEFAULT_META_FEED_SETTINGS,
  normalizeAvailability,
  type MetaFeedResult,
  type MetaFeedSettings,
  type MetaFeedVehicle,
} from "@/lib/meta-feed";

const SETTING_KEYS = {
  availabilityPublished: "meta_availability_published",
  availabilityReserved: "meta_availability_reserved",
  availabilitySold: "meta_availability_sold",
  defaultImageUrl: "meta_default_image_url",
  includeWithoutImages: "meta_include_without_images",
  catalogId: "meta_catalog_id",
  businessPortfolio: "meta_business_portfolio",
  whatsappAccount: "meta_whatsapp_account",
  facebookPage: "meta_facebook_page",
  phoneNumber: "meta_phone_number",
  dataSourceId: "meta_data_source_id",
  lastImportStatus: "meta_last_import_status",
  lastImportAt: "meta_last_import_at",
} as const;

type SettingRow = { key: string; value: string; updated_at: Date };

export async function getMetaFeedSettings(): Promise<{ settings: MetaFeedSettings; settingsUpdatedAt: string | null }> {
  const result = await query<SettingRow>("SELECT key,value,updated_at FROM site_settings WHERE key LIKE 'meta_%'");
  const values = new Map(result.rows.map(row => [row.key, row.value]));
  const settings: MetaFeedSettings = {
    availabilityPublished: normalizeAvailability(values.get(SETTING_KEYS.availabilityPublished), DEFAULT_META_FEED_SETTINGS.availabilityPublished),
    availabilityReserved: normalizeAvailability(values.get(SETTING_KEYS.availabilityReserved), DEFAULT_META_FEED_SETTINGS.availabilityReserved),
    availabilitySold: normalizeAvailability(values.get(SETTING_KEYS.availabilitySold), DEFAULT_META_FEED_SETTINGS.availabilitySold),
    defaultImageUrl: values.get(SETTING_KEYS.defaultImageUrl) ?? DEFAULT_META_FEED_SETTINGS.defaultImageUrl,
    includeWithoutImages: (values.get(SETTING_KEYS.includeWithoutImages) ?? "false") === "true",
    catalogId: values.get(SETTING_KEYS.catalogId) ?? "",
    businessPortfolio: values.get(SETTING_KEYS.businessPortfolio) ?? "",
    whatsappAccount: values.get(SETTING_KEYS.whatsappAccount) ?? "",
    facebookPage: values.get(SETTING_KEYS.facebookPage) ?? "",
    phoneNumber: values.get(SETTING_KEYS.phoneNumber) ?? DEFAULT_META_FEED_SETTINGS.phoneNumber,
    dataSourceId: values.get(SETTING_KEYS.dataSourceId) ?? "",
    lastImportStatus: values.get(SETTING_KEYS.lastImportStatus) ?? "",
    lastImportAt: values.get(SETTING_KEYS.lastImportAt) ?? "",
  };
  const updated = result.rows.map(row => row.updated_at).sort((a, b) => b.getTime() - a.getTime())[0];
  return { settings, settingsUpdatedAt: updated?.toISOString() ?? null };
}

export async function getMetaFeedSnapshot(): Promise<MetaFeedResult & { lastModified: string | null; settings: MetaFeedSettings }> {
  const [vehicles, config, lastChange] = await Promise.all([
    query<MetaFeedVehicle>(`SELECT id,slug,title,description,status,stock_status,price_cents,image_url,images,
      brand,model,version,year_make,year_model,mileage,transmission,fuel,body_type,color,city,updated_at
      FROM vehicles ORDER BY updated_at DESC`),
    getMetaFeedSettings(),
    query<{ updated_at: Date | null }>("SELECT max(updated_at) AS updated_at FROM vehicles"),
  ]);
  const feed = buildMetaFeed(vehicles.rows, config.settings);
  const vehicleUpdated = lastChange.rows[0]?.updated_at?.toISOString() ?? null;
  const candidates = [vehicleUpdated, config.settingsUpdatedAt].filter((value): value is string => Boolean(value)).sort().reverse();
  return { ...feed, lastModified: candidates[0] ?? null, settings: config.settings };
}

export async function saveMetaFeedSettings(input: Partial<MetaFeedSettings>): Promise<void> {
  const current = (await getMetaFeedSettings()).settings;
  const next: MetaFeedSettings = {
    availabilityPublished: normalizeAvailability(input.availabilityPublished, current.availabilityPublished),
    availabilityReserved: normalizeAvailability(input.availabilityReserved, current.availabilityReserved),
    availabilitySold: normalizeAvailability(input.availabilitySold, current.availabilitySold),
    defaultImageUrl: String(input.defaultImageUrl ?? current.defaultImageUrl).trim().slice(0, 2000),
    includeWithoutImages: input.includeWithoutImages ?? current.includeWithoutImages,
    catalogId: String(input.catalogId ?? current.catalogId).trim().slice(0, 200),
    businessPortfolio: String(input.businessPortfolio ?? current.businessPortfolio).trim().slice(0, 300),
    whatsappAccount: String(input.whatsappAccount ?? current.whatsappAccount).trim().slice(0, 300),
    facebookPage: String(input.facebookPage ?? current.facebookPage).trim().slice(0, 300),
    phoneNumber: String(input.phoneNumber ?? current.phoneNumber).trim().slice(0, 40),
    dataSourceId: String(input.dataSourceId ?? current.dataSourceId).trim().slice(0, 200),
    lastImportStatus: String(input.lastImportStatus ?? current.lastImportStatus).trim().slice(0, 500),
    lastImportAt: String(input.lastImportAt ?? current.lastImportAt).trim().slice(0, 80),
  };

  const entries = (Object.keys(SETTING_KEYS) as Array<keyof typeof SETTING_KEYS>).map(key => {
    const value = key === "includeWithoutImages" ? String(next[key]) : String(next[key]);
    return [SETTING_KEYS[key], value] as const;
  });
  await Promise.all(entries.map(([key, value]) => query(
    "INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()",
    [key, value],
  )));
}

