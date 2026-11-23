import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ProfileForm } from "@/components/games/profile-form";
import { requireUser } from "@/lib/auth/session";
import { getGamingProfile, getMyRatings, getRatingHistory } from "@/lib/data/phase5";

export const metadata: Metadata = { title: "Gaming profile" };

export default async function GamingProfilePage() {
  const user = await requireUser();
  const [profile, ratings, history] = await Promise.all([
    getGamingProfile(user.id),
    getMyRatings(user.id),
    getRatingHistory(user.id),
  ]);

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Games / Profile</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Gaming identity</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">Choose how you appear in match rooms and on leaderboards. Academic identity details stay private.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <ProfileForm profile={profile} />
        <div className="space-y-6">
          <section className="border border-navy/10 bg-white p-6">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-bold uppercase tracking-wide text-navy"><UserRound className="size-5 text-cobalt" /> Rating snapshot</h2>
            <div className="mt-4 space-y-2">
              {ratings.length ? ratings.map((rating) => (
                <div key={`${rating.user_id}-${rating.game_slug}`} className="flex items-center justify-between border-b border-navy/8 pb-2 text-sm">
                  <span className="font-semibold text-navy">{rating.game_slug}</span>
                  <span className="font-heading text-xl font-bold text-cobalt">{rating.rating}</span>
                </div>
              )) : <p className="text-sm text-ink-muted">Play a ranked match to establish a rating.</p>}
            </div>
          </section>
          <section className="border border-navy/10 bg-white p-6">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-navy">Recent rating changes</h2>
            <div className="mt-4 space-y-2">
              {history.length ? history.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border-b border-navy/8 pb-2 text-sm">
                  <span className="text-ink-muted">{entry.game_slug} · {new Date(entry.created_at).toLocaleDateString()}</span>
                  <span className={`font-heading text-xl font-bold ${entry.delta >= 0 ? "text-[#33521b]" : "text-coral-dark"}`}>
                    {entry.delta > 0 ? "+" : ""}{entry.delta}
                  </span>
                </div>
              )) : <p className="text-sm text-ink-muted">No rating changes yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
