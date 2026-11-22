"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/app/(public)/reset-password/actions";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [result, setResult] = useState<ActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setResult(await updatePassword(values));
  }

  if (!hasSession) {
    return (
      <div className="border-l-4 border-l-coral bg-coral/10 p-6">
        <h2 className="text-xl font-bold">Reset link required</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy/75">
          Open the password reset link sent to your college email, then set a new
          password here.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/forgot-password">Request a reset link</Link>
        </Button>
      </div>
    );
  }

  if (result?.status === "success") {
    return (
      <div className="border-l-4 border-l-lime bg-lime/15 p-6">
        <CheckCircle2 className="size-7 text-[#3d641c]" />
        <h2 className="mt-4 text-2xl font-bold">Password updated</h2>
        <p className="mt-2 text-sm text-navy/75">{result.message}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {result?.status === "error" ? (
        <p role="alert" className="border-l-4 border-l-coral bg-coral/10 p-4 text-sm text-[#8b3725]">
          {result.message}
        </p>
      ) : null}
      <div>
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="mt-2"
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-1.5 text-xs font-semibold text-coral-dark">{errors.password.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="new-password-confirm">Confirm new password</Label>
        <Input
          id="new-password-confirm"
          type="password"
          autoComplete="new-password"
          className="mt-2"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="mt-1.5 text-xs font-semibold text-coral-dark">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
