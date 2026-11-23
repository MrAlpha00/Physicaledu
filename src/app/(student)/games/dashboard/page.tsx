import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock3, History, Swords, Trophy, UserRound } from "lucide-react";
import { ChallengeActions } from "@/components/games/challenge-actions";
import { GameResultBanner } from "@/components/games/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import {
  getGamingProfile,
  getMyChallenges,
  getMyMatches,
  getMyRatings,
  getRecentResults,
} from "@/lib/data/phase5";
import { GAME_DEFINITIONS } from "@/lib/games/catalog";
import type { GameSlug } from "@/lib/games/types";

export const metadata: Metadata = { title: "Games dashboard" };

export default async function GamesDashboardPage() {
  const user = await requireUser();
  const [ratings, challenges, matches, results, profile] = await Promise.all([
    getMyRatings(user.id),
    getMyChallenges(user.id),
    getMyMatches(user.id, 20),
    getRecentResults(user.id, 10),
    getGamingProfile(user.id),
  ]);
  const ratingMap = new Map(ratings.map((row) => [row.game_slug as GameSlug, row]));
  const pending = challenges.filter((challenge) => challenge.status === "pending");
  const ongoing = matches.filter((match) => ["waiting", "countdown", "active"].includes(match.status));
  const nameFor = (slug: string) => GAME_DEFINITIONS[slug as GameSlug]?.shortName ?? slug;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden bg-navy px-6 py-10 text-chalk sm:px-9">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border-[26px] border-lime/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Games / Dashboard</p>
            <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Your arena</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-chalk/75">
              Six independent ratings, live invitations and match rooms. Guest and practice games never appear here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="lime"><Link href="/games"><Swords className="size-4" /> Find a game</Link></Button>
            <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:border-lime hover:bg-lime/10 hover:text-lime"><Link href="/games/profile"><UserRound className="size-4" /> Gaming profile</Link></Button>
          </div>
        </div>
      </section>

      {!profile ? (
        <div className="border-l-4 border-l-coral bg-coral/10 px-5 py-4 text-sm text-coral-dark">
          Set up your gaming profile before issuing or accepting challenges. <Link href="/games/profile" className="font-bold underline">Create it now →</Link>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cobalt">Separate standings</p>
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">My ratings</h2>
          </div>
          <Link href="/games" className="text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">Play more games →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(GAME_DEFINITIONS) as GameSlug[]).map((slug) => {
            const rating = ratingMap.get(slug);
            const game = GAME_DEFINITIONS[slug];
            return (
              <Link key={slug} href={`/games/${slug}/leaderboard`} className="group border border-navy/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-navy hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-heading text-xl font-bold uppercase tracking-wide text-navy group-hover:text-cobalt">{game.shortName}</p>
                  <Trophy className="size-4 text-navy/30" />
                </div>
                <p className="mt-3 font-heading text-4xl font-bold leading-none text-navy">{rating?.rating ?? "—"}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {rating ? `${rating.played} played · ${rating.wins}W / ${rating.losses}L / ${rating.draws}D` : "Unrated — play a ranked match"}
                </p>
                <div className="mt-3 h-1.5 w-full bg-navy/10"><div className="h-full bg-lime" style={{ width: rating ? `${Math.min(100, (rating.rating / 2000) * 100)}%` : "0%" }} /></div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-navy pb-2">
            <Swords className="size-5 text-cobalt" />
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Invitations</h2>
            <Badge variant="cobalt">{pending.length}</Badge>
          </div>
          {pending.length ? (
            <div className="space-y-3">
              {pending.map((challenge) => {
                const incoming = challenge.opponent_id === user.id;
                return (
                  <div key={challenge.id} className="border border-navy/10 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-heading text-xl font-bold uppercase text-navy">{nameFor(challenge.game_slug)}</p>
                        <p className="text-xs text-ink-muted">
                          {incoming ? `From ${challenge.challengerName ?? "a student"}` : `To ${challenge.opponentName ?? "a student"}`}
                        </p>
                      </div>
                      <Badge variant="muted"><Clock3 className="size-3" /> {new Date(challenge.expires_at).toLocaleDateString()}</Badge>
                    </div>
                    {challenge.message ? <p className="mt-2 text-sm text-ink-muted">“{challenge.message}”</p> : null}
                    <div className="mt-3"><ChallengeActions id={challenge.id} incoming={incoming} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No pending invitations. <Link href="/games/challenges" className="font-bold text-cobalt hover:underline">Challenge someone →</Link></p>}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-navy pb-2">
            <Clock3 className="size-5 text-cobalt" />
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Ongoing matches</h2>
            <Badge variant="cobalt">{ongoing.length}</Badge>
          </div>
          {ongoing.length ? (
            <div className="space-y-3">
              {ongoing.map((match) => (
                <Link key={match.id} href={`/games/match/${match.public_id}`} className="flex items-center justify-between gap-3 border border-navy/10 bg-white p-4 transition hover:border-cobalt">
                  <div>
                    <p className="font-heading text-xl font-bold uppercase text-navy">{nameFor(match.game_slug)}</p>
                    <p className="text-xs text-ink-muted">Room {match.public_id.slice(0, 8)} · updated {new Date(match.updated_at).toLocaleString()}</p>
                  </div>
                  <Badge variant={match.status === "active" ? "lime" : "muted"}>{match.status}</Badge>
                </Link>
              ))}
            </div>
          ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No active match rooms.</p>}
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-navy pb-2">
          <div className="flex items-center gap-2">
            <History className="size-5 text-cobalt" />
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Recent results</h2>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/games/history">Full history <ArrowUpRight className="size-3" /></Link></Button>
        </div>
        {results.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((match) => {
              const me = match.players.find((player) => player.user_id === user.id);
              const names: [string, string] = [
                match.players.find((player) => player.player_index === 0)?.display_name ?? "Player 1",
                match.players.find((player) => player.player_index === 1)?.display_name ?? "Player 2",
              ];
              return (
                <div key={match.id} className="border border-navy/10 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-cobalt">{nameFor(match.game_slug)} · {new Date(match.ended_at ?? match.updated_at).toLocaleDateString()}</p>
                  <GameResultBanner outcome={match.outcome as never} names={names} />
                  {me?.rating_delta !== null && me?.rating_delta !== undefined ? (
                    <p className="mt-2 text-xs text-ink-muted">Rating change: {me.rating_delta > 0 ? "+" : ""}{me.rating_delta}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : <p className="border border-dashed border-navy/20 bg-white px-5 py-8 text-center text-sm text-ink-muted">No completed ranked matches yet.</p>}
      </section>
    </div>
  );
}
