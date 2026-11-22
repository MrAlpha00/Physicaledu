import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<{
  next?: string;
  registered?: string;
  signedOut?: string;
}>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const notice =
    params.registered === "1"
      ? "Your account is ready. Sign in to continue."
      : params.signedOut === "1"
        ? "You have been signed out."
        : null;

  return (
    <div className="border-t-4 border-t-navy bg-chalk">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:py-20">
        <div className="hidden flex-col justify-between border-r border-navy/10 pr-12 lg:flex">
          <div>
            <p className="eyebrow text-cobalt">Secure access</p>
            <h1 className="mt-4 text-6xl font-bold leading-[0.9]">
              Back in
              <br />
              <span className="text-cobalt">the game.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-muted">
              Sign in with your college account to view your profile, verification
              status and PE membership information.
            </p>
          </div>
          <div className="track-lines border-l-4 border-l-lime bg-navy p-6 text-chalk">
            <p className="eyebrow text-lime">PE membership note</p>
            <p className="mt-3 text-sm leading-relaxed text-chalk/75">
              Having a student account does not mean you are enrolled in PE class.
              Your dashboard will always show your real roster status.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md self-center">
          <div className="border border-navy/15 bg-card p-6 shadow-[8px_8px_0_rgba(16,29,44,0.08)] sm:p-8">
            <h2 className="text-3xl font-bold">Sign in</h2>
            <p className="mt-2 text-sm text-ink-muted">Use your college email and password.</p>

            {notice ? (
              <div className="mt-6 flex gap-3 border-l-4 border-l-lime bg-lime/15 p-4 text-sm text-[#33521b]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{notice}</span>
              </div>
            ) : null}

            <div className="mt-7">
              <LoginForm nextPath={params.next} />
            </div>

            <div className="mt-7 border-t border-border pt-5 text-sm text-ink-muted">
              New to the platform?{" "}
              <Link href="/register" className="font-bold text-cobalt hover:underline">
                Register here
              </Link>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
            <AlertCircle className="size-3.5" />
            Account access is restricted to members of the college community.
          </p>
        </div>
      </div>
    </div>
  );
}
