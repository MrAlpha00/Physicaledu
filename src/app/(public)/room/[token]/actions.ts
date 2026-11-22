"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeRoomError } from "@/lib/operations/rooms";
import type { ActionState } from "@/types/domain";

export async function enterRoom(token: string, activityId?: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_enter_room", {
    p_token: token,
    p_activity_id: activityId || null,
  });
  if (error) return { status: "error", message: describeRoomError(error.message) };
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/dashboard");
  return { status: "success", message: "Room entry recorded." };
}

export async function exitRoom(token: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_exit_room", { p_token: token });
  if (error) return { status: "error", message: describeRoomError(error.message) };
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/dashboard");
  return { status: "success", message: "Room exit recorded. Thank you!" };
}
