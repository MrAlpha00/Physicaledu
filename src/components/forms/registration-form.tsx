"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
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
import { registerStudent, type RegisterState } from "@/app/(public)/register/actions";
import {
  registrationSchema,
  type RegistrationInput,
} from "@/lib/validations/auth";
import type { ActiveDepartment } from "@/types/domain";
import { EmptyState } from "@/components/shared/empty-state";
import { ClipboardList } from "lucide-react";

const ACADEMIC_YEARS = [1, 2, 3, 4, 5, 6];
const SEMESTERS = Array.from({ length: 12 }, (_, index) => index + 1);

export function RegistrationForm({
  departments,
}: {
  departments: ActiveDepartment[];
}) {
  const [result, setResult] = useState<RegisterState | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      usn: "",
      email: "",
      departmentId: "",
      academicYear: 1,
      semester: 1,
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegistrationInput) {
    setResult(null);
    try {
      const response = await registerStudent(values);
      setResult(response);
    } catch {
      setResult({
        status: "error",
        message: "Registration is unavailable right now. Please try again later.",
        emailConfirmation: false,
      });
    }
  }

  if (departments.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Department setup required"
        description="Registration is not open yet. The PE office needs to configure the college departments first."
      />
    );
  }

  if (result?.status === "success") {
    return (
      <div className="border-l-4 border-l-lime bg-lime/15 p-6">
        <CheckCircle2 className="size-7 text-[#3d641c]" />
        <h2 className="mt-4 text-2xl font-bold">Account created</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy/75">{result.message}</p>
        <Button asChild className="mt-6" variant="default">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {result?.status === "error" ? (
        <div
          role="alert"
          className="flex gap-3 border-l-4 border-l-coral bg-coral/10 p-4 text-sm text-[#8b3725]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{result.message}</span>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor="fullName" label="Full name" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="As printed on your college record"
            aria-invalid={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </Field>
        <Field htmlFor="usn" label="USN" error={errors.usn?.message}>
          <Input
            id="usn"
            placeholder="e.g. 1AB21CS001"
            autoCapitalize="characters"
            aria-invalid={Boolean(errors.usn)}
            {...register("usn")}
          />
        </Field>
        <Field
          htmlFor="email"
          label="College email address"
          error={errors.email?.message}
          className="sm:col-span-2"
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>
        <Field htmlFor="departmentId" label="Department" error={errors.departmentId?.message}>
          <Controller
            control={control}
            name="departmentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="departmentId" aria-invalid={Boolean(errors.departmentId)}>
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
        </Field>
        <Field htmlFor="academicYear" label="Academic year" error={errors.academicYear?.message}>
          <Controller
            control={control}
            name="academicYear"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger id="academicYear">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      Year {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field htmlFor="semester" label="Semester" error={errors.semester?.message}>
          <Controller
            control={control}
            name="semester"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger id="semester">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((semester) => (
                    <SelectItem key={semester} value={String(semester)}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field htmlFor="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>
        <Field htmlFor="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        Use 8+ characters with upper and lowercase letters and a number. New
        accounts always receive the student role — PE admin access is never
        available through registration.
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Creating account…" : "Create student account"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1.5 text-xs font-semibold text-coral-dark">{error}</p> : null}
    </div>
  );
}
