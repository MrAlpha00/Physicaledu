export function getSecretSupabaseKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  }

  return key;
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;

  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
