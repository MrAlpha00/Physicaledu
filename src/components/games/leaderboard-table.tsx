import { Medal } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/data/phase5";
import { cn } from "@/lib/utils";

export function LeaderboardTable({ entries, compact = false }: { entries: LeaderboardEntry[]; compact?: boolean }) {
  if (!entries.length) {
    return <p className="border border-dashed border-navy/20 bg-white px-5 py-10 text-center text-sm text-ink-muted">No ranked results yet.</p>;
  }
  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-navy text-chalk">
          <tr>
            <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest">Rank</th>
            <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest">Player</th>
            <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">Rating</th>
            {!compact ? (
              <>
                <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">Played</th>
                <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">W–L–D</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.userId} className={cn("border-t border-navy/8", entry.rank <= 3 ? "bg-lime/10" : "")}>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 font-heading text-xl font-bold text-navy/50">
                  {entry.rank === 1 ? <Medal className="size-4 text-cobalt" /> : null}{entry.rank}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-navy">{entry.gamingName}</td>
              <td className="px-4 py-3 text-right font-heading text-2xl font-bold text-cobalt">{entry.rating}</td>
              {!compact ? (
                <>
                  <td className="px-4 py-3 text-right text-ink-muted">{entry.played}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{entry.wins}–{entry.losses}–{entry.draws}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
