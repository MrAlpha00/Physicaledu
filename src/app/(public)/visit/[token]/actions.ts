"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { describeVisitorError, honeypotTriggered } from "@/lib/operations/visitors";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { visitorRateLimiter } from "@/lib/utils/rate-limit";
import { visitorFormSchema, type VisitorFormInput } from "@/lib/validations/phase2";
import type { ActionState } from "@/types/domain";

async function clientKey(): Promise<string> {
  const requestHeaders = await headers();
  const raw =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  const salt = process.env.SUPABASE_SECRET_KEY ?? "varsity-public-form";
  return createHash("sha256").update(`${raw}:${salt}`).digest("hex");
}

export async function submitVisitorEntry(input: VisitorFormInput): Promise<ActionState> {
  const parsed = visitorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the visitor details and try again." };
  }
  const values = parsed.data;

  // Silent success for bots: never reveal which control rejected the request.
  if (honeypotTriggered(values.honeypot)) {
    return { status: "success", message: "Visitor entry submitted successfully." };
  }

  const limit = visitorRateLimiter.check(await clientKey());
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Too many submissions from this device. Please try again shortly.",
    };
  }

  const requestHeaders = await headers();
  const botCheckPassed = await verifyTurnstileToken(
    values.turnstileToken,
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
  );
  if (!botCheckPassed) {
    return { status: "error", message: "Verification could not be completed. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.rpc("submit_visitor_entry", {
    p_token: values.token,
    p_full_name: user ? "" : values.fullName || "",
    p_usn: user ? null : values.usn || null,
    p_department_id: user ? null : values.departmentId || null,
    p_academic_year: user ? null : values.academicYear ?? null,
    p_semester: user ? null : values.semester ?? null,
    p_purpose_id: values.purposeId,
    p_purpose_detail: values.purposeDetail || null,
    p_description: values.description || null,
    p_bot_check_passed: true,
  });

  if (error) return { status: "error", message: describeVisitorError(error.message) };

  revalidatePath("/visitors/today");
  revalidatePath("/admin/visitors");
  revalidatePath("/admin/dashboard");
  return { status: "success", message: "Visitor entry recorded. Thank you." };
}
