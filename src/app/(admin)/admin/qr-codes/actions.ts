"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types/domain";

function refreshQr() {
  revalidatePath("/admin/qr-codes");
  revalidatePath("/admin/qr-codes/print");
}

export async function setQrActive(qrId: string, active: boolean): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_qr_active", {
    p_qr_id: qrId,
    p_active: active,
  });
  if (error) return { status: "error", message: error.message || "QR status could not be changed." };
  refreshQr();
  return { status: "success", message: active ? "QR code activated." : "QR code deactivated." };
}

export async function regenerateQr(qrId: string): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_regenerate_qr", { p_qr_id: qrId });
  if (error) return { status: "error", message: error.message || "QR code could not be regenerated." };
  refreshQr();
  return {
    status: "success",
    message: "QR code regenerated. The previous code is now invalid — download and post the new one.",
  };
}
