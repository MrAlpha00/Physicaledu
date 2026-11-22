"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { roomConfigSchema, roomActivitySchema } from "@/lib/validations/phase2";
import type { ActionState } from "@/types/domain";

function refreshRooms() {
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/rooms/config");
  revalidatePath("/admin/dashboard");
}

export async function saveRoomConfig(input: {
  roomId: string;
  name: string;
  description: string;
  instructions: string;
  requiresActivity: boolean;
  maxSessionMinutes: number;
  isActive: boolean;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = roomConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the room configuration and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pe_rooms")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      instructions: parsed.data.instructions || null,
      requires_activity: parsed.data.requiresActivity,
      max_session_minutes: parsed.data.maxSessionMinutes,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.roomId);
  if (error) return { status: "error", message: "Room configuration could not be saved." };
  refreshRooms();
  return { status: "success", message: "Room configuration saved." };
}

export async function addRoomActivity(input: {
  roomId: string;
  name: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = roomActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid activity." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("room_activities").insert({
    room_id: parsed.data.roomId,
    name: parsed.data.name,
  });
  if (error) {
    return { status: "error", message: "Activity could not be added. Check for duplicates." };
  }
  refreshRooms();
  return { status: "success", message: "Activity added." };
}

export async function setRoomActivityActive(
  activityId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_activities")
    .update({ is_active: isActive })
    .eq("id", activityId);
  if (error) return { status: "error", message: "Activity status could not be changed." };
  refreshRooms();
  return { status: "success", message: isActive ? "Activity enabled." : "Activity disabled." };
}

export async function closeRoomSession(
  sessionId: string,
  reason: string,
): Promise<ActionState> {
  await requirePeAdmin();
  if (!reason.trim()) {
    return { status: "error", message: "Give a reason for the forced closure." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_close_room_session", {
    p_session_id: sessionId,
    p_reason: reason.trim(),
  });
  if (error) return { status: "error", message: error.message || "Session could not be closed." };
  refreshRooms();
  return { status: "success", message: "Session closed and audit entry recorded." };
}
