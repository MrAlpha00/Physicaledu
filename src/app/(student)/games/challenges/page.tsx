import type { Metadata } from "next";
import { Swords } from "lucide-react";
import { ChallengeActions } from "@/components/games/challenge-actions";
import { ChallengeForm } from "@/components/games/challenge-form";
import { requireUser } from "@/lib/auth/session";
import { getMyChallenges } from "@/lib/data/phase5";
import { GAME_DEFINITIONS } from "@/lib/games/catalog";
import type { GameSlug } from "@/lib/games/types";

export const metadata: Metadata = { title: "Game challenges" };

export default async function ChallengesPage() {
  const user = await requireUser();
  const challenges = await getMyChallenges(user.id);
  const nameFor = (slug: string) => GAME_DEFINITIONS[slug as GameSlug]?.shortName ?? slug;

  const groups = [
    { label: "Pending", statuses: ["pending"] },
    { label: "Accepted", statuses: ["accepted"] },
    { label: "Declined / expired / cancelled", statuses: ["declined", "expired", "cancelled"] },
  ];

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Games / Challenges</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Challenge a student</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">
          Search for a verified student, choose a game and send an invitation. Accepting creates a private match room with server-authoritative play.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <ChallengeForm />
        <div className="space-y-6">
          {groups.map((group) => {
            const rows = challenges.filter((challenge) => group.statuses.includes(challenge.status));
            return (
              <section key={group.label} className="space-y-3">
                <div className="flex items-center gap-2 border-b-2 border-navy pb-2">
                  <Swords className="size-5 text-cobalt" />
                  <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-navy">{group.label}</h2>
                  <span className="text-xs text-ink-muted">({rows.length})</span>
                </div>
                {rows.length ? (
                  <div className="space-y-2">
                    {rows.map((challenge) => {
                      const incoming = challenge.opponent_id === user.id;
                      return (
                        <div key={challenge.id} className="border border-navy/10 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-heading text-xl font-bold uppercase text-navy">{nameFor(challenge.game_slug)}</p>
                              <p className="text-xs text-ink-muted">
                                {incoming ? `${challenge.challengerName ?? "Student"} → you` : `You → ${challenge.opponentName ?? "Student"}`}
                              </p>
                            </div>
                            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-muted">{challenge.status}</span>
                          </div>
                          {challenge.message ? <p className="mt-2 text-sm text-ink-muted">“{challenge.message}”</p> : null}
                          {challenge.status === "pending" ? <div className="mt-3"><ChallengeActions id={challenge.id} incoming={incoming} /></div> : null}
                          {challenge.status === "accepted" && challenge.match_id ? (
                            <p className="mt-3 text-xs text-cobalt">Match room ready in your dashboard.</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="border border-dashed border-navy/20 bg-white px-4 py-6 text-center text-sm text-ink-muted">Nothing here.</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
