import type { Metadata } from "next";
import { Award, ClipboardCheck, ShieldCheck, XCircle } from "lucide-react";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAdminAchievements, getDirectoryStudents } from "@/lib/data/phase3-sports";
import { percentage } from "@/lib/operations/phase3";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { AchievementTable } from "@/components/phase3/sports/achievement-table";
import { AchievementReviewActions } from "@/components/phase3/sports/achievement-review-actions";
import { AdminAchievementForm, type StudentOption } from "@/components/phase3/sports/admin-achievement-form";
import type { AchievementView } from "@/types/domain";

export const metadata: Metadata = { title: "Sports profiles & achievements" };

export default async function AdminSportsProfilesPage() {
  await requirePeAdmin();
  const supabase = await createClient();
  const [achievements, students, departmentsResult, participationResult] = await Promise.all([
    getAdminAchievements(),
    getDirectoryStudents(),
    supabase.from("departments").select("id, department_name"),
    supabase
      .from("sports_participation_records")
      .select("student_directory_id")
      .eq("is_verified", true)
      .limit(20000),
  ]);

  const departmentNames = new Map((departmentsResult.data ?? []).map((row) => [row.id, row.department_name]));
  const studentOptions: StudentOption[] = students.map((student) => ({
    id: student.id,
    label: [
      student.full_name,
      departmentNames.get(student.department_id) ?? "Department",
      student.academic_year ? `Year ${student.academic_year}` : null,
      student.semester ? `Sem ${student.semester}` : null,
    ].filter(Boolean).join(" · "),
  }));

  const participationCounts: Record<string, number> = {};
  for (const row of participationResult.data ?? []) {
    participationCounts[row.student_directory_id] = (participationCounts[row.student_directory_id] ?? 0) + 1;
  }

  const byStatus = {
    pending: achievements.filter((row) => row.verificationStatus === "pending"),
    verified: achievements.filter((row) => row.verificationStatus === "verified"),
    rejected: achievements.filter((row) => row.verificationStatus === "rejected"),
  };
  const verifiedShare = percentage(byStatus.verified.length, achievements.length);

  const reviewActions = Object.fromEntries(
    [...byStatus.pending, ...byStatus.rejected].map((row) => [
      row.id,
      <AchievementReviewActions key={row.id} achievementId={row.id} status={row.verificationStatus} />,
    ]),
  ) as Record<string, React.ReactNode>;

  function group(title: string, rows: AchievementView[], tone: "warn" | "good" | "bad", emptyLabel: string) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-barlow text-3xl tracking-tight text-navy">{title}</h2>
          <Phase3StatusBadge label={`${rows.length} record${rows.length === 1 ? "" : "s"}`} tone={tone} />
        </div>
        <AchievementTable
          achievements={rows}
          showStudent
          participationCounts={participationCounts}
          actions={tone === "warn" || tone === "bad" ? reviewActions : undefined}
          emptyLabel={emptyLabel}
        />
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="PE Admin / Student records"
        title="Sports profiles"
        description="Review achievement claims, record verified department achievements and see the verified participation count attached to each student."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Phase3Metric label="Total achievements" value={achievements.length} detail="All recorded statuses" icon={Award} tone="navy" />
        <Phase3Metric label="Pending review" value={byStatus.pending.length} detail="Student suggestions await a decision" icon={ClipboardCheck} tone="lime" />
        <Phase3Metric label="Verified" value={byStatus.verified.length} detail={`${verifiedShare}% of all records`} icon={ShieldCheck} tone="cobalt" />
        <Phase3Metric label="Rejected" value={byStatus.rejected.length} detail="Can be restored after review" icon={XCircle} tone="coral" />
      </div>

      <Phase3Notice>
        Student suggestions are always stored as pending. Only this PE Admin queue can verify or reject them. Public profiles, when explicitly enabled by a student, display verified achievements only.
      </Phase3Notice>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          {group("Pending review", byStatus.pending, "warn", "No suggestions are waiting for review.")}
          {group("Verified achievements", byStatus.verified, "good", "No verified achievements yet.")}
          {group("Rejected achievements", byStatus.rejected, "bad", "No rejected achievements.")}
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <AdminAchievementForm students={studentOptions} />
        </div>
      </div>
    </div>
  );
}
