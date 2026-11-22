"use server";

import { createClient } from "@/lib/supabase/server";
import { profileNameSchema } from "@/lib/validations/admin";
import type { ActionState } from "@/types/domain";

export async function updateProfileName(input: { fullName: string }): Promise<ActionState> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid full name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You must be signed in to update your profile." };
  }

  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: parsed.data.fullName,
  });

  if (error) {
    return { status: "error", message: "Your name could not be updated. Please try again." };
  }

  return { status: "success", message: "Profile updated." };
}
