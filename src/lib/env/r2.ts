import "server-only";

/**
 * Server-only R2 configuration. Never import from a Client Component and never
 * expose these values through a NEXT_PUBLIC_ variable.
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

export function getR2Config(): R2Config {
  const values = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `Cloudflare R2 is not configured. Missing: ${missing.join(", ")}. Check docs/R2_SETUP.md.`,
    );
  }
  if (!/^https:\/\//.test(values.endpoint!)) {
    throw new Error("R2_ENDPOINT must be an https:// URL.");
  }

  return values as R2Config;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ENDPOINT,
  );
}
