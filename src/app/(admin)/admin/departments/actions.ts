"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { departmentSchema, type DepartmentInput } from "@/lib/validations/admin";
import type { ActionState } from "@/types/domain";

export async function saveDepartment(
  input: DepartmentInput & { id?: string },
): Promise<ActionState> {
  await requirePeAdmin();

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the department details and try again." };
  }

  const code = parsed.data.departmentCode.toUpperCase();
  const supabase = await createClient();

  const duplicate = await supabase
    .from("departments")
    .select("id")
    .eq("department_code", code)
    .maybeSingle();

  if (duplicate.data && duplicate.data.id !== input.id) {
    return {
      status: "error",
      message: "That department code already exists.",
      fieldErrors: { departmentCode: ["Code already in use"] },
    };
  }

  if (input.id) {
    const { error } = await supabase
      .from("departments")
      .update({
        department_code: code,
        department_name: parsed.data.departmentName,
      })
      .eq("id", input.id);

    if (error) {
      return { status: "error", message: "Department could not be updated." };
    }
  } else {
    const { error } = await supabase.from("departments").insert({
      department_code: code,
      department_name: parsed.data.departmentName,
      is_active: true,
    });

    if (error) {
      return { status: "error", message: "Department could not be created." };
    }
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin/dashboard");
  revalidatePath("/register");
  return {
    status: "success",
    message: input.id ? "Department updated." : "Department added.",
  };
}

export async function toggleDepartmentActive(
  departmentId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requirePeAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ is_active: !isActive })
    .eq("id", departmentId);

  if (error) {
    return { status: "error", message: "Department status could not be changed." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin/dashboard");
  revalidatePath("/register");
  return {
    status: "success",
    message: isActive ? "Department deactivated." : "Department activated.",
  };
}
