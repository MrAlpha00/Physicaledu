"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createManualStudent } from "@/app/(admin)/admin/students/actions";
import {
  manualStudentSchema,
  type ManualStudentInput,
} from "@/lib/validations/admin";
import type { ActionState, DepartmentOption } from "@/types/domain";

export function ManualStudentForm({
  departments,
  onDone,
}: {
  departments: DepartmentOption[];
  onDone: () => void;
}) {
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualStudentInput>({
    resolver: zodResolver(manualStudentSchema),
    defaultValues: {
      usn: "",
      fullName: "",
      departmentId: "",
      academicYear: 1,
      semester: 1,
      officialEmail: "",
    },
  });

  async function onSubmit(values: ManualStudentInput) {
    setBusy(true);
    setNotice(null);
    const result = await createManualStudent(values);
    setBusy(false);
    setNotice(result);
    if (result.status === "success") onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {notice?.status === "error" ? (
        <p role="alert" className="border-l-4 border-l-coral bg-coral/10 p-3 text-sm text-[#8b3725]">
          {notice.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="manual-usn">USN</Label>
          <Input id="manual-usn" className="mt-2 uppercase" {...register("usn")} />
          {errors.usn ? <p className="mt-1 text-xs text-coral-dark">{errors.usn.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="manual-name">Full name</Label>
          <Input id="manual-name" className="mt-2" {...register("fullName")} />
          {errors.fullName ? <p className="mt-1 text-xs text-coral-dark">{errors.fullName.message}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="manual-department">Department</Label>
          <Controller
            control={control}
            name="departmentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="manual-department" className="mt-2">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.code} — {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.departmentId ? (
            <p className="mt-1 text-xs text-coral-dark">{errors.departmentId.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="manual-year">Academic year</Label>
          <Controller
            control={control}
            name="academicYear"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                <SelectTrigger id="manual-year" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((year) => (
                    <SelectItem key={year} value={String(year)}>Year {year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label htmlFor="manual-semester">Semester</Label>
          <Controller
            control={control}
            name="semester"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                <SelectTrigger id="manual-semester" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((semester) => (
                    <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="manual-email">Official email (optional)</Label>
          <Input id="manual-email" type="email" className="mt-2" {...register("officialEmail")} />
          {errors.officialEmail ? (
            <p className="mt-1 text-xs text-coral-dark">{errors.officialEmail.message}</p>
          ) : null}
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <LoaderCircle className="animate-spin" /> : null}
        {busy ? "Adding record…" : "Add official record"}
      </Button>
    </form>
  );
}
