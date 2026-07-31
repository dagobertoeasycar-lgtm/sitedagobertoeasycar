export function publicUrl(path: string, requestUrl: string) {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return new URL(path, configured || requestUrl);
}
