"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types/domain";

export async function setPeMembership(
  studentDirectoryId: string,
  active: boolean,
  notes?: string,
): Promise<ActionState> {
  await requirePeAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_pe_membership", {
    p_student_directory_id: studentDirectoryId,
    p_active: active,
    p_notes: notes ?? null,
  });

  if (error) {
    const text = error.message.toLowerCase();
    return {
      status: "error",
      message: text.includes("already an active")
        ? "This student is already on the active PE roster."
        : "Membership could not be updated. Please try again.",
    };
  }

  revalidatePath("/admin/pe-roster");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/students");
  return {
    status: "success",
    message: active ? "Student added to PE class." : "Student removed from active PE membership.",
  };
}
