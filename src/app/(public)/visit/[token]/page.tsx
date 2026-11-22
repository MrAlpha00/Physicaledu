import type { Metadata } from "next";
import { QrCode, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getVisitorPurposes } from "@/lib/data/visitors";
import { createClient } from "@/lib/supabase/server";
import { isTurnstileConfigured } from "@/lib/security/turnstile";
import { VisitorForm } from "@/components/visitor/visitor-form";

export const metadata: Metadata = { title: "PE visitor register" };

export default async function VisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [resolution, purposesResult, departmentsResult, user] = await Promise.all([
    supabase.rpc("resolve_qr_token", { p_token: token }),
    getVisitorPurposes(),
    supabase.from("departments").select("id, department_code, department_name").eq("is_active", true).order("department_code"),
    getCurrentUser(),
  ]);

  const qr = resolution.data?.[0];
  if (!qr || qr.qr_type !== "visitor_entrance") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="border-l-4 border-l-coral bg-card p-8">
          <ShieldAlert className="size-9 text-coral-dark" />
          <h1 className="mt-5 text-4xl font-bold">Invalid visitor QR</h1>
          <p className="mt-4 text-sm text-ink-muted">
            This QR code is inactive or is not the PE Block entrance code. Ask the PE office for
            the current poster.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <div className="border-b-2 border-navy pb-6">
        <p className="eyebrow flex items-center gap-2 text-cobalt">
          <QrCode className="size-3" /> VARSITY PE · Digital visitor register
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none sm:text-6xl">Welcome to PE</h1>
        <p className="mt-4 text-sm text-ink-muted">
          Sign the register before entering the PE block. If you have a VARSITY account, sign in
          first so your details are taken from your official record.
        </p>
      </div>

      <div className="mt-8 border border-navy/15 bg-card p-6 sm:p-9">
        <VisitorForm
          token={token}
          purposes={purposesResult}
          departments={(departmentsResult.data ?? []).map((department) => ({
            id: department.id,
            code: department.department_code,
            name: department.department_name,
          }))}
          isAuthenticated={Boolean(user)}
          turnstileSiteKey={
            isTurnstileConfigured() ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null
          }
        />
      </div>
    </div>
  );
}
