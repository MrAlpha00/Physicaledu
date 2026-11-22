import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { UserRoundX } from "lucide-react";
import { getPublicSportsProfile } from "@/lib/data/phase3-sports";
import { formatIstDate } from "@/lib/time/india";
import { EmptyState } from "@/components/shared/empty-state";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Student sports profile" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function NotPublic() {
  return (
    <div className="space-y-8">
      <Phase3Header kicker="VARSITY / PE department" title="Sports profile" description="Public student sports profiles are opt-in." />
      <EmptyState
        icon={UserRoundX}
        title="This sports profile is not public"
        description="The student has not enabled a public sports profile, or the link is not valid. No achievement, contact or participation information is shown."
        action={<Button asChild variant="outline"><Link href="/">Back to VARSITY</Link></Button>}
      />
    </div>
  );
}

export default async function PublicSportsProfilePage({
  params,
}: {
  params: Promise<{ student: string }>;
}) {
  const { student } = await params;
  if (!z.string().uuid().safeParse(student).success) return <NotPublic />;

  // The RPC itself only returns rows with is_public = true and verified achievements.
  const profile = await getPublicSportsProfile(student);
  if (!profile) return <NotPublic />;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="VARSITY / Student sports directory"
        title={profile.fullName}
        description={[
          profile.departmentName,
          profile.academicYear ? `Year ${profile.academicYear}` : null,
          profile.semester ? `Semester ${profile.semester}` : null,
        ].filter(Boolean).join(" · ")}
      />

      <Phase3Notice>
        This page is published by the student. It shows verified achievements only and never includes USN, email, private profile fields or participation records.
      </Phase3Notice>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-5">
          <div className="border border-navy/10 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">About</p>
            <h2 className="mt-1 font-barlow text-3xl tracking-tight text-navy">Sports profile</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {profile.biography ?? "This student has not added a biography."}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-barlow text-3xl tracking-tight text-navy">Verified achievements</h2>
            {profile.achievements.length === 0 ? (
              <p className="border border-dashed border-navy/20 bg-white/50 px-5 py-8 text-center text-sm text-ink-muted">
                No verified achievements are published yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {profile.achievements.map((achievement, index) => (
                  <article key={`${achievement.title}-${index}`} className="border-l-4 border-l-lime bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt">{achievement.sport}</p>
                    <h3 className="mt-1 font-barlow text-2xl leading-tight text-navy">{achievement.title}</h3>
                    <p className="mt-2 text-xs text-ink-muted">
                      {achievement.eventName ? `${achievement.eventName} · ` : ""}
                      {formatIstDate(achievement.achievementDate)}
                      {achievement.academicYear ? ` · ${achievement.academicYear}` : ""}
                    </p>
                    {achievement.positionResult || achievement.awardDescription ? (
                      <p className="mt-2 text-sm text-navy">
                        {achievement.positionResult}
                        {achievement.positionResult && achievement.awardDescription ? " · " : ""}
                        {achievement.awardDescription}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="border border-navy/10 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral-dark">Interests</p>
            <h2 className="mt-1 font-barlow text-2xl tracking-tight text-navy">Sports interests</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.sportsInterests.length === 0 ? (
                <span className="text-sm text-ink-muted">Not provided</span>
              ) : (
                profile.sportsInterests.map((interest) => <Badge key={interest} variant="cobalt">{interest}</Badge>)
              )}
            </div>
          </div>

          <div className="border border-navy/10 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral-dark">Preferences</p>
            <h2 className="mt-1 font-barlow text-2xl tracking-tight text-navy">Preferred sports</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.preferredSports.length === 0 ? (
                <span className="text-sm text-ink-muted">Not provided</span>
              ) : (
                profile.preferredSports.map((sport) => <Badge key={sport} variant="lime">{sport}</Badge>)
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
