"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export async function login(input: LoginInput, requestedNext?: string): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "Email or password is incorrect. Check your details and try again.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Session could not be established. Please try again." };
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = Boolean(roles?.some((entry) => entry.role === "pe_admin"));

  const next = safeNextPath(requestedNext, isAdmin ? "/admin/dashboard" : "/dashboard");
  if (next.startsWith("/admin") && !isAdmin) {
    redirect("/unauthorized");
  }

  redirect(next);
}
