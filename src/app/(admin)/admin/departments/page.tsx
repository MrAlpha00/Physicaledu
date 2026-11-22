import type { Metadata } from "next";
import { DepartmentsManager } from "@/components/tables/departments-manager";
import { getDepartmentOptions } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const departments = await getDepartmentOptions();

  return (
    <div className="space-y-7">
      <div className="border-b-2 border-navy pb-6">
        <p className="eyebrow text-cobalt">Administration / Setup</p>
        <h1 className="mt-3 text-5xl font-bold leading-none">Departments</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Configure the college departments used during registration and official
          directory import. Only active departments can be selected by students.
        </p>
      </div>
      <DepartmentsManager departments={departments} />
    </div>
  );
}
