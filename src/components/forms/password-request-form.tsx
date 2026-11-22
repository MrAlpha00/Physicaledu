"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset } from "@/app/(public)/forgot-password/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export function PasswordRequestForm() {
  const [result, setResult] = useState<ActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setResult(await sendPasswordReset(values));
  }

  if (result?.status === "success") {
    return (
      <div className="border-l-4 border-l-lime bg-lime/15 p-6">
        <CheckCircle2 className="size-7 text-[#3d641c]" />
        <h2 className="mt-4 text-2xl font-bold">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy/75">{result.message}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/login">Back to sign in</Link>
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
        <Label htmlFor="reset-email">College email address</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          className="mt-2"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p className="mt-1.5 text-xs font-semibold text-coral-dark">{errors.email.message}</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
