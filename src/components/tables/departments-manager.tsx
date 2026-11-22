"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle, Pencil, Plus, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  saveDepartment,
  toggleDepartmentActive,
} from "@/app/(admin)/admin/departments/actions";
import {
  departmentSchema,
  type DepartmentInput,
} from "@/lib/validations/admin";
import type { ActionState, DepartmentOption } from "@/types/domain";
import { Building2 } from "lucide-react";

export function DepartmentsManager({
  departments,
}: {
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentOption | null>(null);
  const [deactivating, setDeactivating] = useState<DepartmentOption | null>(null);
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { departmentCode: "", departmentName: "" },
  });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return departments;
    return departments.filter(
      (department) =>
        department.code.toLowerCase().includes(term) ||
        department.name.toLowerCase().includes(term),
    );
  }, [departments, query]);

  function openCreate() {
    setEditing(null);
    form.reset({ departmentCode: "", departmentName: "" });
    setNotice(null);
    setDialogOpen(true);
  }

  function openEdit(department: DepartmentOption) {
    setEditing(department);
    form.reset({
      departmentCode: department.code,
      departmentName: department.name,
    });
    setNotice(null);
    setDialogOpen(true);
  }

  async function onSubmit(values: DepartmentInput) {
    setBusy(true);
    setNotice(null);
    const result = await saveDepartment({ ...values, id: editing?.id });
    setBusy(false);
    setNotice(result);
    if (result.status === "success") {
      setDialogOpen(false);
      router.refresh();
    }
  }

  async function onToggle(department: DepartmentOption) {
    setBusy(true);
    setNotice(null);
    const result = await toggleDepartmentActive(department.id, department.isActive);
    setBusy(false);
    setNotice(result);
    setDeactivating(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <p
          role="status"
          className={`border-l-4 p-4 text-sm ${
            notice.status === "success"
              ? "border-l-lime bg-lime/15 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by code or name"
            className="pl-9"
            aria-label="Search departments"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus /> Add department
        </Button>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments configured"
          description="Add the college departments before opening student registration. Use the official names and codes from your institution."
          action={<Button onClick={openCreate}>Add first department</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="No department matches your search. Try a different code or name."
        />
      ) : (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-mono text-sm font-bold">{department.code}</TableCell>
                  <TableCell className="font-semibold">{department.name}</TableCell>
                  <TableCell className="stat-number text-2xl">{department.studentCount}</TableCell>
                  <TableCell>
                    <Badge variant={department.isActive ? "lime" : "muted"}>
                      {department.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(department)}
                        aria-label={`Edit ${department.name}`}
                      >
                        <Pencil /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          department.isActive
                            ? setDeactivating(department)
                            : onToggle(department)
                        }
                        aria-label={
                          department.isActive
                            ? `Deactivate ${department.name}`
                            : `Activate ${department.name}`
                        }
                      >
                        {department.isActive ? <ToggleLeft /> : <ToggleRight />}
                        {department.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "Add department"}</DialogTitle>
            <DialogDescription>
              Use the official department code and name. Codes are unique across the
              platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {notice?.status === "error" ? (
              <p className="flex gap-2 border-l-4 border-l-coral bg-coral/10 p-3 text-sm text-[#8b3725]">
                <AlertCircle className="size-4 shrink-0" /> {notice.message}
              </p>
            ) : null}
            <div>
              <Label htmlFor="departmentCode">Department code</Label>
              <Input
                id="departmentCode"
                className="mt-2 uppercase"
                placeholder="e.g. CSE"
                {...form.register("departmentCode")}
              />
              {form.formState.errors.departmentCode ? (
                <p className="mt-1.5 text-xs font-semibold text-coral-dark">
                  {form.formState.errors.departmentCode.message}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="departmentName">Department name</Label>
              <Input
                id="departmentName"
                className="mt-2"
                placeholder="Official department name"
                {...form.register("departmentName")}
              />
              {form.formState.errors.departmentName ? (
                <p className="mt-1.5 text-xs font-semibold text-coral-dark">
                  {form.formState.errors.departmentName.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : null}
                {editing ? "Save changes" : "Add department"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Deactivate department?</AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating?.name} will no longer be available for new registrations or
            directory imports. Existing student records are retained.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivating && onToggle(deactivating)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
