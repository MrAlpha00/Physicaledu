import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { AdminRatingAdjustment } from "@/components/games/admin-rating-adjustment";
import { requirePeAdmin } from "@/lib/auth/session";
import { getAdminAdjustments } from "@/lib/data/phase5";

export const metadata: Metadata = { title: "Game rating adjustments" };

export default async function AdminRatingsPage() {
  await requirePeAdmin();
  const adjustments = await getAdminAdjustments();

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <Link href="/admin/games" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-lime hover:underline"><ArrowLeft className="size-3" /> Game management</Link>
        <p className="mt-5 font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Admin / Games</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Rating adjustments</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">Manual corrections are exceptional and fully audited. Normal rating changes come only from validated completed matches.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <AdminRatingAdjustment />
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-navy pb-2"><Trophy className="size-5 text-cobalt" /><h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Audit trail</h2></div>
          {adjustments.length ? (
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-navy text-chalk"><tr><th className="px-3 py-2 text-xs uppercase">Date</th><th className="px-3 py-2 text-xs uppercase">User</th><th className="px-3 py-2 text-xs uppercase">Game</th><th className="px-3 py-2 text-xs uppercase">Change</th><th className="px-3 py-2 text-xs uppercase">Reason</th></tr></thead>
                <tbody>
                  {adjustments.map((row) => (
                    <tr key={row.id} className="border-t border-navy/8">
                      <td className="px-3 py-2 text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{row.game_slug}</td>
                      <td className="px-3 py-2 font-heading text-lg font-bold text-cobalt">{row.before_rating} → {row.after_rating}</td>
                      <td className="px-3 py-2 text-xs text-ink-muted">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-10 text-center text-sm text-ink-muted">No manual adjustments recorded.</p>}
        </section>
      </div>
    </div>
  );
}
