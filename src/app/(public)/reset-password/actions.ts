"use server";

import { createClient } from "@/lib/supabase/server";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export async function updatePassword(input: ResetPasswordInput): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Passwords must match and meet the strength requirements.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Your reset session has expired. Request a new reset link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      status: "error",
      message: "Password could not be updated. Request a new reset link and try again.",
    };
  }

  return { status: "success", message: "Your password has been updated." };
}
