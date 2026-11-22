"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env/server";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export async function sendPasswordReset(
  input: ForgotPasswordInput,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email.trim().toLowerCase(),
    {
      redirectTo: `${getSiteUrl()}/auth/callback?type=recovery&next=/reset-password`,
    },
  );

  // The same response is returned whether or not an account exists, so the
  // endpoint cannot be used to enumerate registered students.
  if (error) {
    return {
      status: "error",
      message: "The reset request could not be sent. Please try again later.",
    };
  }

  return {
    status: "success",
    message:
      "If an account exists for that address, a password reset link has been sent. Check your inbox.",
  };
}
