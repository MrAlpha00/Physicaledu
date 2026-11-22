import type { Metadata } from "next";
import Link from "next/link";
import { PasswordRequestForm } from "@/components/forms/password-request-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-chalk px-5 py-16">
      <div className="w-full max-w-md">
        <p className="eyebrow text-cobalt">Account recovery</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Reset your password</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Enter the college email linked to your account. We will send a secure reset
          link — no passwords by email.
        </p>
        <div className="mt-8 border border-navy/15 bg-card p-6 shadow-[8px_8px_0_rgba(16,29,44,0.08)] sm:p-8">
          <PasswordRequestForm />
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-cobalt hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
