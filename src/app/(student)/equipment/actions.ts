"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { istLocalInputToIso } from "@/lib/time/india";
import { borrowEquipmentSchema } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

export async function borrowEquipmentAsStudent(input: {
  itemId: string;
  assetId?: string;
  quantity: number;
  expectedReturnAt: string;
  notes?: string;
}): Promise<ActionState> {
  await requireUser();

  if (!input.expectedReturnAt) {
    return { status: "error", message: "Choose an expected return time." };
  }
  const expectedReturnAt = istLocalInputToIso(input.expectedReturnAt);
  if (Number.isNaN(Date.parse(expectedReturnAt))) {
    return { status: "error", message: "Choose a valid expected return time." };
  }

  const parsed = borrowEquipmentSchema.safeParse({
    itemId: input.itemId,
    assetId: input.assetId,
    quantity: input.quantity,
    expectedReturnAt,
    notes: input.notes,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the borrow form." };
  }

  const supabase = await createClient();
  // Identity is inferred by the database from the authenticated profile; the
  // student never supplies (or claims) a directory id.
  const { error } = await supabase.rpc("borrow_equipment", {
    p_item_id: parsed.data.itemId,
    p_asset_id: parsed.data.assetId || null,
    p_quantity: parsed.data.quantity,
    p_expected_return_at: parsed.data.expectedReturnAt,
    p_notes: parsed.data.notes || null,
  });
  if (error) return { status: "error", message: error.message || "Equipment could not be borrowed." };

  revalidatePath("/equipment", "layout");
  revalidatePath("/my-equipment");
  revalidatePath("/admin/equipment", "layout");
  return { status: "success", message: "Equipment issued to you. Collect it from the PE office." };
}
