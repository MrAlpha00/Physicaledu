"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { returnEquipmentSchema } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

export async function returnMyEquipment(input: {
  transactionId: string;
  quantity: number;
  condition: "excellent" | "good" | "fair" | "poor" | "unusable";
  damageIndicator: boolean;
  notes?: string;
  token?: string;
}): Promise<ActionState> {
  await requireUser();

  const parsed = returnEquipmentSchema.safeParse({
    transactionId: input.transactionId,
    quantity: input.quantity,
    condition: input.condition,
    damageIndicator: input.damageIndicator,
    notes: input.notes,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the return form." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_equipment", {
    p_transaction_id: parsed.data.transactionId,
    p_quantity: parsed.data.quantity,
    p_condition: parsed.data.condition,
    p_damage_indicator: parsed.data.damageIndicator,
    p_notes: parsed.data.notes || null,
  });
  if (error) return { status: "error", message: error.message || "Return could not be recorded." };

  revalidatePath("/equipment", "layout");
  revalidatePath("/my-equipment");
  revalidatePath("/admin/equipment", "layout");
  if (input.token) revalidatePath(`/equipment/${input.token}`);
  return { status: "success", message: "Return recorded. Thank you." };
}
