"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env/server";
import { DEFAULT_REGISTRATION_ROLE } from "@/lib/permissions/roles";
import { normalizeUsn } from "@/lib/utils";
import { registrationSchema, type RegistrationInput } from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export type RegisterState = ActionState & { emailConfirmation: boolean };

function fieldErrorsFromZod(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

export async function registerStudent(
  input: RegistrationInput,
): Promise<RegisterState> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      emailConfirmation: false,
    };
  }

  const values = parsed.data;
  const usn = normalizeUsn(values.usn);
  const email = values.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data: department, error: departmentError } = await admin
    .from("departments")
    .select("id")
    .eq("id", values.departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (departmentError || !department) {
    return {
      status: "error",
      message: "That department is not available for registration.",
      fieldErrors: { departmentId: ["Select an active department"] },
      emailConfirmation: false,
    };
  }

  // Duplicate detection covers both the official directory and previously
  // registered accounts (including accounts still awaiting verification).
  const [{ data: directoryMatch }, { data: profileMatch }] = await Promise.all([
    admin.from("student_directory").select("id, official_email").eq("usn", usn).maybeSingle(),
    admin.from("profiles").select("id").eq("requested_usn", usn).maybeSingle(),
  ]);

  if (profileMatch) {
    return {
      status: "error",
      message: "This USN is already registered. Sign in or contact the PE office.",
      fieldErrors: { usn: ["USN already registered"] },
      emailConfirmation: false,
    };
  }

  const emailMatchesDirectory =
    directoryMatch &&
    (!directoryMatch.official_email || directoryMatch.official_email.toLowerCase() === email);
  const directoryId = emailMatchesDirectory ? directoryMatch.id : null;
  const verificationStatus = directoryId ? "verified" : "pending";

  const { data: signUpData, error: signUpError } = await admin.auth.signUp({
    email,
    password: values.password,
    options: {
      data: {
        full_name: values.fullName,
        usn,
        department_id: values.departmentId,
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (signUpError || !signUpData.user) {
    const text = signUpError?.message.toLowerCase() ?? "";
    return {
      status: "error",
      message: text.includes("already registered")
        ? "An account with this email already exists. Sign in instead."
        : "We could not create your account. Please check your details and try again.",
      fieldErrors:
        text.includes("already registered") ? { email: ["Email already registered"] } : undefined,
      emailConfirmation: false,
    };
  }

  const userId = signUpData.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    requested_usn: usn,
    student_directory_id: directoryId,
    full_name: values.fullName,
    email,
    verification_status: verificationStatus,
    account_status: "active",
  });

  let roleError = null;
  if (!profileError) {
    const result = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: DEFAULT_REGISTRATION_ROLE });
    roleError = result.error;
  }

  if (profileError || roleError) {
    // Keep the database consistent: remove the half-created auth account.
    await admin.auth.admin.deleteUser(userId);
    return {
      status: "error",
      message: "Registration could not be completed. Please try again or contact the PE office.",
      emailConfirmation: false,
    };
  }

  const needsConfirmation =
    signUpData.user.confirmed_at === null || (signUpData.user.identities?.length ?? 0) === 0;

  return {
    status: "success",
    message: needsConfirmation
      ? "Account created. Check your college email for the confirmation link, then sign in."
      : "Account created. You can sign in now.",
    emailConfirmation: needsConfirmation,
  };
}
