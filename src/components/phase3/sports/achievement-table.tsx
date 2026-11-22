import { formatIstDate } from "@/lib/time/india";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phase3StatusBadge } from "@/components/phase3/common";
import type { AchievementView } from "@/types/domain";

function statusTone(status: AchievementView["verificationStatus"]) {
  if (status === "verified") return "good" as const;
  if (status === "rejected") return "bad" as const;
  return "warn" as const;
}

export function AchievementTable({
  achievements,
  showStudent = false,
  participationCounts,
  actions,
  emptyLabel = "No achievements in this group.",
}: {
  achievements: AchievementView[];
  showStudent?: boolean;
  participationCounts?: Record<string, number>;
  actions?: Record<string, React.ReactNode>;
  emptyLabel?: string;
}) {
  if (achievements.length === 0) {
    return <p className="border border-dashed border-navy/20 bg-white/50 px-5 py-8 text-center text-sm text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <div className="border border-navy/10 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Achievement</TableHead>
            <TableHead>Sport</TableHead>
            {showStudent ? <TableHead>Student</TableHead> : null}
            {participationCounts ? <TableHead>Verified participation</TableHead> : null}
            <TableHead>Status</TableHead>
            {actions ? <TableHead>Review</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {achievements.map((achievement) => (
            <TableRow key={achievement.id}>
              <TableCell>
                <p className="font-bold text-navy">{achievement.title}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {achievement.eventName ? `${achievement.eventName} · ` : ""}
                  {formatIstDate(achievement.achievementDate)}
                  {achievement.academicYear ? ` · ${achievement.academicYear}` : ""}
                </p>
                {achievement.positionResult || achievement.awardDescription ? (
                  <p className="mt-1 max-w-sm text-xs text-ink-muted">
                    {achievement.positionResult}
                    {achievement.positionResult && achievement.awardDescription ? " · " : ""}
                    {achievement.awardDescription}
                  </p>
                ) : null}
                {achievement.verificationNote ? (
                  <p className="mt-1 text-xs italic text-coral-dark">Note: {achievement.verificationNote}</p>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{achievement.sport}</TableCell>
              {showStudent ? (
                <TableCell>
                  <p className="text-sm font-semibold text-navy">{achievement.studentName}</p>
                  <p className="text-[11px] text-ink-muted">{achievement.sourceType.replaceAll("_", " ")}</p>
                </TableCell>
              ) : null}
              {participationCounts ? (
                <TableCell className="font-barlow text-xl text-cobalt">
                  {participationCounts[achievement.studentDirectoryId] ?? 0}
                </TableCell>
              ) : null}
              <TableCell>
                <Phase3StatusBadge label={achievement.verificationStatus} tone={statusTone(achievement.verificationStatus)} />
              </TableCell>
              {actions ? <TableCell>{actions[achievement.id] ?? null}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
