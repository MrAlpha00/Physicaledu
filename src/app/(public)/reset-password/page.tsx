import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-chalk px-5 py-16">
      <div className="w-full max-w-md">
        <p className="eyebrow text-cobalt">Account recovery</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Set a new password</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Choose a strong password you have not used on this account before.
        </p>
        <div className="mt-8 border border-navy/15 bg-card p-6 shadow-[8px_8px_0_rgba(16,29,44,0.08)] sm:p-8">
          <ResetPasswordForm hasSession={Boolean(user)} />
        </div>
      </div>
    </div>
  );
}
