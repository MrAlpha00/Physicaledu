import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationForm } from "@/components/forms/registration-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActiveDepartment } from "@/types/domain";

export const metadata: Metadata = { title: "Student registration" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  let departments: ActiveDepartment[] = [];
  let loadError = false;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("departments")
      .select("id, department_code, department_name")
      .eq("is_active", true)
      .order("department_name");

    if (error) {
      loadError = true;
    } else {
      departments = (data ?? []).map((department) => ({
        id: department.id,
        code: department.department_code,
        name: department.department_name,
      }));
    }
  } catch {
    loadError = true;
  }

  return (
    <div className="border-t-4 border-t-cobalt bg-chalk">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
        <div className="lg:pr-8">
          <p className="eyebrow text-cobalt">Student access</p>
          <h1 className="mt-4 text-5xl font-bold leading-[0.9] sm:text-6xl">
            Join the
            <br />
            <span className="text-cobalt">roster.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-muted">
            Register with your USN and college email. If your record is in the
            official directory, your account is linked automatically. Otherwise it
            stays pending until the PE office verifies it.
          </p>
          <div className="mt-8 border-l-4 border-l-lime bg-card p-5">
            <p className="eyebrow text-ink-muted">Good to know</p>
            <p className="mt-2 text-sm leading-relaxed text-navy/75">
              Registration creates a college student account. It does not enroll you in
              PE class — the PE department adds students to the roster separately.
            </p>
          </div>
          <p className="mt-8 text-sm text-ink-muted">
            Already registered?{" "}
            <Link href="/login" className="font-bold text-cobalt underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="border border-navy/15 bg-card p-6 shadow-[8px_8px_0_rgba(16,29,44,0.08)] sm:p-9">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-navy pb-4">
            <h2 className="text-2xl font-bold">Create account</h2>
            <span className="eyebrow text-ink-muted">Step 01 / 01</span>
          </div>
          {loadError ? (
            <div role="alert" className="border-l-4 border-l-coral bg-coral/10 p-5 text-sm text-[#8b3725]">
              Department records could not be loaded. Confirm the database migration
              has been applied, then refresh this page.
            </div>
          ) : (
            <RegistrationForm departments={departments} />
          )}
        </div>
      </div>
    </div>
  );
}
