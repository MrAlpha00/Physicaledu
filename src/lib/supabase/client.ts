import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
