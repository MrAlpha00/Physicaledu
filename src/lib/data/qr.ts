import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { QrCodeView } from "@/types/domain";

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
