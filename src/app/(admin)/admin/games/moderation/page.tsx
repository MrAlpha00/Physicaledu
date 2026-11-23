import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flag, ShieldCheck, UserRound } from "lucide-react";
import { AdminModerationForms } from "@/components/games/admin-moderation-forms";
import { requirePeAdmin } from "@/lib/auth/session";
import { getAdminDisputes, getAdminReports, getAdminRestrictions } from "@/lib/data/phase5";
import { reviewDisputeAction, reviewReportAction } from "@/app/(admin)/admin/games/actions";

export const metadata: Metadata = { title: "Game moderation" };

export default async function AdminGamesModerationPage() {
  await requirePeAdmin();
  const [reports, disputes, restrictions] = await Promise.all([
    getAdminReports(), getAdminDisputes(), getAdminRestrictions(),
  ]);

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <Link href="/admin/games" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-lime hover:underline"><ArrowLeft className="size-3" /> Game management</Link>
        <p className="mt-5 font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Admin / Games</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Reports & moderation</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">Review reports, resolve disputes and apply restrictions. Every moderation action is audited.</p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-navy pb-2"><Flag className="size-5 text-cobalt" /><h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Reports</h2></div>
        {reports.length ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="border border-navy/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-xl font-bold uppercase text-navy">{report.reason.replace("_", " ")}</p>
                    <p className="text-xs text-ink-muted">{report.game_slug ?? "General"} · {new Date(report.created_at).toLocaleString()} · {report.status}</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-cobalt">{report.id.slice(0, 8)}</span>
                </div>
                <p className="mt-2 text-sm text-ink-muted">{report.details}</p>
                <form action={reviewReportAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={report.id} />
                  <select name="status" className="border border-input bg-white px-2 py-1.5 text-sm text-navy">
                    <option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
                  </select>
                  <input name="note" placeholder="Review note" className="min-w-48 flex-1 border border-input bg-white px-2 py-1.5 text-sm text-navy" />
                  <button type="submit" className="bg-navy px-3 py-2 text-xs font-bold uppercase tracking-widest text-chalk">Update</button>
                </form>
              </article>
            ))}
          </div>
        ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No reports.</p>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-navy pb-2"><ShieldCheck className="size-5 text-cobalt" /><h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Disputes</h2></div>
        {disputes.length ? (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <article key={dispute.id} className="border border-navy/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-xl font-bold uppercase text-navy">{dispute.reason}</p>
                    <p className="text-xs text-ink-muted">Match {dispute.match_id.slice(0, 8)} · {new Date(dispute.created_at).toLocaleString()} · {dispute.status}</p>
                  </div>
                </div>
                {dispute.details ? <p className="mt-2 text-sm text-ink-muted">{dispute.details}</p> : null}
                <form action={reviewDisputeAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={dispute.id} />
                  <select name="status" className="border border-input bg-white px-2 py-1.5 text-sm text-navy">
                    <option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
                  </select>
                  <input name="note" placeholder="Resolution" className="min-w-48 flex-1 border border-input bg-white px-2 py-1.5 text-sm text-navy" />
                  <button type="submit" className="bg-navy px-3 py-2 text-xs font-bold uppercase tracking-widest text-chalk">Update</button>
                </form>
              </article>
            ))}
          </div>
        ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No disputes.</p>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-navy pb-2"><UserRound className="size-5 text-cobalt" /><h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Active restrictions</h2></div>
        {restrictions.filter((row) => row.is_active).length ? (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-navy text-chalk"><tr><th className="px-4 py-2 text-xs uppercase">User</th><th className="px-4 py-2 text-xs uppercase">Type</th><th className="px-4 py-2 text-xs uppercase">Game</th><th className="px-4 py-2 text-xs uppercase">Reason</th></tr></thead>
              <tbody>
                {restrictions.filter((row) => row.is_active).map((row) => (
                  <tr key={row.id} className="border-t border-navy/8"><td className="px-4 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td><td className="px-4 py-2">{row.restriction_type}</td><td className="px-4 py-2">{row.game_slug ?? "All"}</td><td className="px-4 py-2">{row.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No active restrictions.</p>}
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2"><h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Moderation tools</h2></div>
        <AdminModerationForms />
      </section>
    </div>
  );
}
