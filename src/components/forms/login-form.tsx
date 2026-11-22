"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/(public)/login/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [error, setError] = useState<ActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    const result = await login(values, nextPath);
    if (result?.status === "error") setError(result);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {error ? (
        <div role="alert" className="flex gap-3 border-l-4 border-l-coral bg-coral/10 p-4 text-sm text-[#8b3725]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : null}

      <div>
        <Label htmlFor="login-email">College email address</Label>
        <Input
          id="login-email"
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

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-cobalt hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="mt-2"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-1.5 text-xs font-semibold text-coral-dark">{errors.password.message}</p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
