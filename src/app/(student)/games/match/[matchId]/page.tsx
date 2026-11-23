import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { GameStage } from "@/components/games/game-stage";
import { MatchForms } from "@/components/games/match-forms";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { getMatchByPublicId } from "@/lib/data/phase5";
import { isGameSlug } from "@/lib/games/catalog";
import type { GameSlug, PlayerIndex } from "@/lib/games/types";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Match room" };
export const dynamic = "force-dynamic";

function asRecord(value: Json): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {};
}

export default async function MatchRoomPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const user = await requireUser();
  const match = await getMatchByPublicId(matchId);
  if (!match || !isGameSlug(match.game_slug)) notFound();

  const players = [...match.players].sort((a, b) => a.player_index - b.player_index);
  const viewer = players.find((player) => player.user_id === user.id)?.player_index;
  if (viewer === undefined) notFound();

  const names: [string, string] = [
    players.find((player) => player.player_index === 0)?.display_name ?? "Player 1",
    players.find((player) => player.player_index === 1)?.display_name ?? "Player 2",
  ];
  const ready: [boolean, boolean] = [
    players.find((player) => player.player_index === 0)?.ready ?? false,
    players.find((player) => player.player_index === 1)?.ready ?? false,
  ];
  const connected: [boolean, boolean] = [
    players.find((player) => player.player_index === 0)?.connected ?? false,
    players.find((player) => player.player_index === 1)?.connected ?? false,
  ];
  const reportedUserId = players.find((player) => player.player_index !== viewer)?.user_id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/games/dashboard" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">
          <ArrowLeft className="size-3" /> Games dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="muted"><LockKeyhole className="size-3" /> Participants only</Badge>
          <Badge variant="cobalt">Room {match.public_id.slice(0, 8)}</Badge>
        </div>
      </div>

      <section className="relative overflow-hidden bg-navy px-6 py-8 text-chalk sm:px-9">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-[0.25em] text-lime">Ranked match room</p>
            <h1 className="mt-2 font-heading text-4xl font-bold uppercase leading-none tracking-tight md:text-5xl">{names[0]} vs {names[1]}</h1>
            <p className="mt-3 text-sm text-chalk/70">Every move is validated on the server before it is stored. Realtime messages only refresh this view.</p>
          </div>
          <Badge variant={match.status === "active" ? "lime" : "cobalt"}>{match.status}</Badge>
        </div>
      </section>

      <GameStage
        key={`${match.public_id}:${match.version}:${match.status}`}
        slug={match.game_slug as GameSlug}
        mode="ranked"
        names={names}
        config={asRecord(match.config)}
        initialState={match.state}
        matchPublicId={match.public_id}
        viewer={viewer as PlayerIndex}
        initialStatus={match.status}
        ready={ready}
        connected={connected}
        notice={undefined}
      />

      <MatchForms
        publicId={match.public_id}
        slug={match.game_slug as GameSlug}
        reportedUserId={reportedUserId}
        canResign={["waiting", "countdown", "active"].includes(match.status)}
      />
    </div>
  );
}
