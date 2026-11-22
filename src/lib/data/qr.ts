import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { QrCodeView } from "@/types/domain";
import type { Database } from "@/types/database";
import { isCurrentUserPeAdmin } from "@/lib/auth/session";

export const getQrCodes = cache(async (): Promise<QrCodeView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("qr_codes")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    qrType: row.qr_type,
    destinationPath: row.destination_path,
    roomId: row.room_id,
    theme: row.theme,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

export type AdminQrRow = Database["public"]["Tables"]["qr_codes"]["Row"];

/**
 * Raw token access is restricted to PE Admin callers because admins must be
 * able to re-render and reprint QR posters. Never expose this through a public
 * component or audit entry.
 */
export const getAdminQrCodes = cache(async (): Promise<AdminQrRow[]> => {
  if (!(await isCurrentUserPeAdmin())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("qr_codes")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
});

export const getAdminQrCode = cache(
  async (qrId: string): Promise<AdminQrRow | null> => {
    if (!(await isCurrentUserPeAdmin())) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("id", qrId)
      .maybeSingle();
    return data ?? null;
  },
);
