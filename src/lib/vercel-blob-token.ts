const vercelBlobTokenPrefix = "vercel_blob_rw_";

export function getVercelBlobToken(environment: NodeJS.ProcessEnv = process.env) {
  const standardToken = environment.BLOB_READ_WRITE_TOKEN?.trim();
  if (standardToken?.startsWith(vercelBlobTokenPrefix)) return standardToken;

  for (const [name, rawValue] of Object.entries(environment)) {
    if (!name.endsWith("_READ_WRITE_TOKEN")) continue;
    const value = rawValue?.trim();
    if (value?.startsWith(vercelBlobTokenPrefix)) return value;
  }

  return null;
}
