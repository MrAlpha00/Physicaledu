import type { Metadata } from "next";
import { StudentsManager } from "@/components/tables/students-manager";
import {
  getDepartmentOptions,
  getDirectoryRows,
  getImportHistory,
  getStudentAccounts,
} from "@/lib/data/admin";

export const metadata: Metadata = { title: "Student management" };

export default async function AdminStudentsPage() {
  const [accounts, directory, departments, importHistory] = await Promise.all([
    getStudentAccounts(),
    getDirectoryRows(),
    getDepartmentOptions(),
    getImportHistory(),
  ]);

  return (
    <div className="space-y-7">
      <div className="border-b-2 border-navy pb-6">
        <p className="eyebrow text-cobalt">Administration / Students</p>
        <h1 className="mt-3 text-5xl font-bold leading-none">Student management</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Manage registered accounts, the official college directory and verified
          student details. Directory records never create login accounts by themselves.
        </p>
      </div>
      <StudentsManager
        accounts={accounts}
        directory={directory}
        departments={departments}
        importHistory={importHistory}
      />
    </div>
  );
}
