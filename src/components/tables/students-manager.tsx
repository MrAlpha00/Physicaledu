"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentAccountsTable } from "@/components/tables/student-accounts-table";
import { DirectoryTable } from "@/components/tables/directory-table";
import { ManualStudentForm } from "@/components/forms/manual-student-form";
import { DirectoryImportPanel } from "@/components/forms/directory-import-panel";
import type {
  DepartmentOption,
  DirectoryRow,
  ImportBatchSummary,
  StudentAccountRow,
} from "@/types/domain";
import { cn } from "@/lib/utils";

type Tab = "accounts" | "directory" | "import";

export function StudentsManager({
  accounts,
  directory,
  departments,
  importHistory,
}: {
  accounts: StudentAccountRow[];
  directory: DirectoryRow[];
  departments: DepartmentOption[];
  importHistory: ImportBatchSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("accounts");
  const [manualOpen, setManualOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DirectoryRow | null>(null);

  function openCreate() {
    setEditingRecord(null);
    setManualOpen(true);
  }

  function openCorrection(record: DirectoryRow) {
    setEditingRecord(record);
    setManualOpen(true);
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "accounts", label: "Registered accounts", count: accounts.length },
    { id: "directory", label: "Official directory", count: directory.length },
    { id: "import", label: "Directory import", count: importHistory.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                tab === entry.id
                  ? "border-cobalt text-cobalt"
                  : "border-transparent text-ink-muted hover:text-navy",
              )}
            >
              {entry.label}
              <span className="ml-2 text-[0.65rem] text-ink-muted">{entry.count}</span>
            </button>
          ))}
        </div>
        <Button onClick={openCreate} className="self-start">
          <UserPlus /> Add student record
        </Button>
      </div>

      {tab === "accounts" ? <StudentAccountsTable students={accounts} /> : null}
      {tab === "directory" ? (
        <DirectoryTable records={directory} departments={departments} onEdit={openCorrection} />
      ) : null}
      {tab === "import" ? <DirectoryImportPanel history={importHistory} /> : null}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Correct official student record" : "Add official student record"}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? "Review every field carefully. Confirming writes the corrected details to the official directory and records an audit entry. Linked account USNs cannot be changed here."
                : "Creates a directory record only. The student can link their own account later during registration."}
            </DialogDescription>
          </DialogHeader>
          <ManualStudentForm
            key={editingRecord?.id ?? "new"}
            record={editingRecord ?? undefined}
            departments={departments.filter((department) => department.isActive)}
            onDone={() => {
              setManualOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
