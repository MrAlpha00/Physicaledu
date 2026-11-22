import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function getMyRoles(userId?: string): Promise<AppRole[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const targetId = userId ?? user?.id;

  if (!targetId) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", targetId);

  if (error) return [];
  return data.map((entry) => entry.role);
}

export async function isCurrentUserPeAdmin(): Promise<boolean> {
  const roles = await getMyRoles();
  return roles.includes("pe_admin");
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return user;
}

export async function requirePeAdmin(): Promise<User> {
  const user = await requireUser();

  if (!(await isCurrentUserPeAdmin())) {
    redirect("/unauthorized");
  }

  return user;
}
