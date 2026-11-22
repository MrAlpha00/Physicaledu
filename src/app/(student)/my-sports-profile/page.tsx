import type { Metadata } from "next";
import Link from "next/link";
import { Award, CalendarCheck2, CheckCircle2, Clock3 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAchievements, getMySportsProfile } from "@/lib/data/phase3-sports";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { AchievementTable } from "@/components/phase3/sports/achievement-table";
import { SportsProfileForm } from "@/components/phase3/sports/sports-profile-form";
import { AchievementSuggestionForm } from "@/components/phase3/sports/achievement-suggestion-form";
import type { AchievementView } from "@/types/domain";

export const metadata: Metadata = { title: "My sports profile" };
export const dynamic = "force-dynamic";

export default async function MySportsProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [profile, allAchievements, identityResult] = await Promise.all([
    getMySportsProfile(user),
    getMyAchievements(),
    supabase.from("profiles").select("student_directory_id").eq("id", user.id).maybeSingle(),
  ]);

  const directoryId = (identityResult.data as { student_directory_id?: string | null } | null)?.student_directory_id ?? null;
  const myAchievements = allAchievements.filter(
    (row): row is AchievementView => Boolean(directoryId) && row.studentDirectoryId === directoryId,
  );
  const pendingCount = myAchievements.filter((row) => row.verificationStatus === "pending").length;
  const verifiedCount = myAchievements.filter((row) => row.verificationStatus === "verified").length;
  const rejectedCount = myAchievements.filter((row) => row.verificationStatus === "rejected").length;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="For students / PE department"
        title="My sports profile"
        description="Manage your public profile details, track verified participation and suggest achievements for PE Admin review."
        actions={
          profile.isPublic && directoryId ? (
            <Phase3StatusBadge label="Public profile on" tone="good" />
          ) : (
            <Phase3StatusBadge label="Private profile" tone="neutral" />
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Phase3Metric label="Verified participation" value={profile.participationCount} detail="From verified PE activity records" icon={CalendarCheck2} tone="cobalt" />
        <Phase3Metric label="Verified achievements" value={verifiedCount} detail="Visible on a public profile if enabled" icon={CheckCircle2} tone="lime" />
        <Phase3Metric label="Pending suggestions" value={pendingCount} detail="Awaiting PE Admin review" icon={Clock3} tone="navy" />
        <Phase3Metric label="Rejected" value={rejectedCount} detail="Review notes, where supplied, appear below" icon={Award} tone="coral" />
      </div>

      <Phase3Notice>
        Only your own achievements are listed here. Your public page, if enabled, will show verified achievements only — never pending or rejected records, USN, email or participation internals.
      </Phase3Notice>

      {!directoryId ? (
        <Phase3Notice tone="warning">
          Your account is not linked to an active student directory record. You can still save your profile, but achievement suggestions require that link.
        </Phase3Notice>
      ) : null}

      {profile.isPublic && directoryId ? (
        <p className="text-xs font-bold text-cobalt">
          <Link href={`/sports-profile/${directoryId}`} className="underline underline-offset-4">
            View your public sports profile →
          </Link>
        </p>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SportsProfileForm
          profile={{
            userId: profile.userId,
            biography: profile.biography,
            sportsInterests: profile.sportsInterests,
            preferredSports: profile.preferredSports,
            isPublic: profile.isPublic,
          }}
        />
        <AchievementSuggestionForm />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-barlow text-3xl tracking-tight text-navy">My achievements</h2>
          <Phase3StatusBadge label={`${myAchievements.length} total`} tone="neutral" />
        </div>
        <AchievementTable achievements={myAchievements} emptyLabel="You have not suggested any achievements yet." />
      </section>
    </div>
  );
}
