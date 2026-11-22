import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange, type VisitorDatePreset } from "@/lib/time/india";
import type { PublicVisitor, VisitorPurpose, VisitorRecordView } from "@/types/domain";

export const getVisitorPurposes = cache(async (): Promise<VisitorPurpose[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visitor_purposes")
    .select("id, label, is_active, sort_order")
    .order("sort_order");
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
});

export interface VisitorFilters {
  preset: VisitorDatePreset;
  from?: string;
  to?: string;
  search?: string;
  purposeId?: string;
  departmentId?: string;
}

export const getAdminVisitors = cache(
  async (filters: VisitorFilters): Promise<VisitorRecordView[]> => {
    const supabase = await createClient();
    const range = resolveDateRange(filters.preset, new Date(), {
      from: filters.from,
      to: filters.to,
    });

    let query = supabase
      .from("visitor_records")
      .select("*")
      .order("visited_at", { ascending: false })
      .limit(1000);
    if (range.start) query = query.gte("visited_at", range.start.toISOString());
    if (range.end) query = query.lt("visited_at", range.end.toISOString());
    if (filters.purposeId) query = query.eq("purpose_id", filters.purposeId);
    if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
    if (filters.search) {
      const term = `%${filters.search.replace(/[%,]/g, "")}%`;
      query = query.or(`full_name.ilike.${term},usn.ilike.${term}`);
    }

    const { data } = await query;
    if (!data?.length) return [];

    const purposeIds = [...new Set(data.map((row) => row.purpose_id))];
    const departmentIds = [
      ...new Set(data.map((row) => row.department_id).filter((id): id is string => Boolean(id))),
    ];
    const [{ data: purposes }, { data: departments }] = await Promise.all([
      purposeIds.length
        ? supabase.from("visitor_purposes").select("id, label").in("id", purposeIds)
        : { data: [] as Array<{ id: string; label: string }> },
      departmentIds.length
        ? supabase
            .from("departments")
            .select("id, department_code, department_name")
            .in("id", departmentIds)
        : { data: [] as Array<{ id: string; department_code: string; department_name: string }> },
    ]);

    const purposeMap = new Map((purposes ?? []).map((row) => [row.id, row.label]));
    const departmentMap = new Map(
      (departments ?? []).map((row) => [row.id, row]),
    );

    return data.map((row) => {
      const department = row.department_id ? departmentMap.get(row.department_id) : undefined;
      return {
        id: row.id,
        fullName: row.full_name,
        usn: row.usn,
        departmentCode: department?.department_code ?? null,
        departmentName: department?.department_name ?? null,
        academicYear: row.academic_year,
        semester: row.semester,
        purposeLabel: purposeMap.get(row.purpose_id) ?? "Visit",
        purposeDetail: row.purpose_detail,
        description: row.description,
        identitySource: row.identity_source,
        visitedAt: row.visited_at,
      };
    });
  },
);

export const getPublicTodayVisitors = cache(async (): Promise<PublicVisitor[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_today_visitors");
  if (error) return [];
  return (data ?? []).map((row) => ({
    visitorLabel: row.visitor_label,
    purposeLabel: row.purpose_label,
    visitedAt: row.visited_at,
  }));
});
