import type { Metadata } from "next";
import Link from "next/link";
import { BellPlus, MailWarning, Megaphone, UsersRound } from "lucide-react";
import { AnnouncementComposer } from "@/components/phase3/notifications/announcement-composer";
import { StudentGroupManager } from "@/components/phase3/notifications/student-group-manager";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePeAdmin } from "@/lib/auth/session";
import { getDepartmentOptions } from "@/lib/data/admin";
import { getAdminAnnouncements, getEmailDailyUsage, getStudentGroups } from "@/lib/data/phase3-notifications";
import { getDirectoryStudents } from "@/lib/data/phase3-sports";
import { getResendConfigurationWarning } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { istDateString } from "@/lib/time/india";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

/**
 * RLS limits notification reads to their owner, so aggregate counts are read
 * with the service-role client. Only counts are exposed, never user ids.
 */
async function getNotifiedCounts(): Promise<Record<string, number>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("notifications")
      .select("announcement_id")
      .not("announcement_id", "is", null)
      .limit(5000);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      if (row.announcement_id) counts[row.announcement_id] = (counts[row.announcement_id] ?? 0) + 1;
    });
    return counts;
  } catch {
    return {};
  }
}

export default async function AdminAnnouncementsPage() {
  await requirePeAdmin();
  const [announcements, groups, departments, students, usage] = await Promise.all([
    getAdminAnnouncements(),
    getStudentGroups(),
    getDepartmentOptions(),
    getDirectoryStudents(),
    getEmailDailyUsage(),
  ]);
  const warning = getResendConfigurationWarning();
  const notifiedCounts = await getNotifiedCounts();
  // The attachment is uploaded before the announcement row exists; the server
  // issues a stable parent id so client and server markup stay identical.
  const uploadParentId = crypto.randomUUID();
  const today = istDateString();
  const acceptedToday = usage.find((row) => row.usage_date === today)?.accepted_count ?? 0;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Communications"
        title="Announcements"
        description="Publish in-app notices to the right students. Email is optional and always sent from the admin queue."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/notifications">Email queue</Link>
          </Button>
        }
      />

      {warning ? (
        <Phase3Notice tone="warning">
          <span className="flex flex-wrap items-center gap-2"><MailWarning className="size-4" /> {warning}</span>
        </Phase3Notice>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Phase3Metric label="Announcements" value={announcements.length} detail="Published in this workspace" icon={Megaphone} />
        <Phase3Metric label="Recipients today" value={acceptedToday} detail="Accepted by the provider (IST)" icon={BellPlus} tone="lime" />
        <Phase3Metric label="Student groups" value={groups.length} detail="Available as audiences" icon={UsersRound} tone="cobalt" />
        <Phase3Metric label="With email" value={announcements.filter((item) => item.emailAnnouncementId).length} detail="Queued for individual delivery" icon={MailWarning} tone="coral" />
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Compose</h2>
          <p className="mt-1 text-xs text-ink-muted">Every audience selection creates in-app notifications for matching active accounts.</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
          <AnnouncementComposer
            departments={departments}
            groups={groups.map((group) => ({ id: group.id, name: group.name, isActive: group.isActive }))}
            students={students.map((student) => ({ id: student.id, full_name: student.full_name }))}
            emailWarning={warning}
            uploadParentId={uploadParentId}
          />
          <div className="space-y-4">
            <div className="border border-navy/10 bg-white p-6 shadow-sm">
              <Megaphone className="size-6 text-coral" />
              <h3 className="mt-3 text-xl font-bold">How delivery works</h3>
              <ol className="mt-3 space-y-2 text-sm text-ink-muted">
                <li>1. The PE desk selects audiences; matching active accounts get an in-app notification.</li>
                <li>2. If email is selected, a private queue is created with one message per recipient.</li>
                <li>3. An admin sends a bounded batch from the email queue. Delivery is confirmed by webhook.</li>
              </ol>
            </div>
            <Phase3Notice>
              Recipient email addresses are only shown on the admin email queue page. They are never added to CC or exposed to students.
            </Phase3Notice>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Student groups</h2>
          <p className="mt-1 text-xs text-ink-muted">Create a group, then add or remove students from the directory.</p>
        </div>
        <StudentGroupManager
          groups={groups}
          students={students.map((student) => ({ id: student.id, full_name: student.full_name, is_active: student.is_active }))}
        />
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Recent announcements</h2>
          <p className="text-xs text-ink-muted">In-app counts and email queue progress for the latest publications.</p>
        </div>
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Announcement</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Notified</TableHead>
                <TableHead>Email queue</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-10 text-center text-sm text-ink-muted">No announcements published yet.</TableCell>
                </TableRow>
              ) : (
                announcements.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{item.message}</p>
                    </TableCell>
                    <TableCell>
                      <Phase3StatusBadge
                        label={item.priority}
                        tone={item.priority === "urgent" || item.priority === "high" ? "bad" : item.priority === "low" ? "neutral" : "info"}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{item.audienceSummary ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums text-ink-muted">{notifiedCounts[item.id] ?? 0} in app</TableCell>
                    <TableCell className="text-xs text-ink-muted">
                      {item.emailAnnouncementId ? (
                        <>
                          <Phase3StatusBadge label={item.emailStatus ?? "queued"} tone={item.emailStatus === "completed" ? "good" : "info"} />
                          <span className="mt-1 block tabular-nums">
                            {item.emailAcceptedCount} accepted · {item.emailDeliveredCount} delivered · {item.emailRecipientCount} queued total
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px]">In-app only</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{item.publishedAt.slice(0, 10)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
