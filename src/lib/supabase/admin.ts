import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/env/public";
import { getSecretSupabaseKey } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Privileged server-only client. Never import this from a Client Component.
 * Used exclusively for trusted workflows such as account registration, where
 * unauthenticated users cannot be granted insert access to profiles or roles.
 */
export function createAdminClient() {
  const { url } = getPublicSupabaseConfig();
  const secretKey = getSecretSupabaseKey();

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
