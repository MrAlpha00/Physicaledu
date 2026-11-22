"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types/domain";

export async function setVisitorPurposeActive(
  purposeId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("visitor_purposes")
    .update({ is_active: isActive })
    .eq("id", purposeId);
  if (error) return { status: "error", message: "Purpose could not be updated." };
  revalidatePath("/admin/visitors");
  revalidatePath(`/visit`);
  return { status: "success", message: isActive ? "Purpose enabled." : "Purpose disabled." };
}

export async function addVisitorPurpose(label: string): Promise<ActionState> {
  await requirePeAdmin();
  const name = label.trim();
  if (name.length < 2 || name.length > 60) {
    return { status: "error", message: "Enter a purpose between 2 and 60 characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("visitor_purposes").insert({
    label: name,
    sort_order: 100,
  });
  if (error) {
    return { status: "error", message: "That purpose already exists or could not be added." };
  }
  revalidatePath("/admin/visitors");
  return { status: "success", message: "Purpose added." };
}

export async function correctVisitorRecord(
  visitorId: string,
  reason: string,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_correct_visitor_record", {
    p_visitor_id: visitorId,
    p_reason: reason,
  });
  if (error) return { status: "error", message: error.message || "Correction could not be recorded." };
  revalidatePath("/admin/visitors");
  return { status: "success", message: "Correction recorded in the audit log." };
}
