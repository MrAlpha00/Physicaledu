import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Inbox, MailWarning, Send, ShieldAlert } from "lucide-react";
import { EmailQueueActions } from "@/components/phase3/notifications/email-queue-actions";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePeAdmin } from "@/lib/auth/session";
import { getEmailAnnouncements, getEmailDailyUsage, getEmailRecipients } from "@/lib/data/phase3-notifications";
import { getResendConfigurationWarning } from "@/lib/email/resend";
import { istDateString } from "@/lib/time/india";

export const metadata: Metadata = { title: "Email queue" };
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  await requirePeAdmin();
  const { email } = await searchParams;
  const [emails, usage] = await Promise.all([getEmailAnnouncements(), getEmailDailyUsage()]);
  const warning = getResendConfigurationWarning();
  const selected = (email ? emails.find((item) => item.id === email) : emails[0]) ?? null;
  const recipients = selected ? await getEmailRecipients(selected.id) : [];
  const today = istDateString();
  const acceptedToday = usage.find((row) => row.usage_date === today)?.accepted_count ?? 0;
  const queuedTotal = emails.reduce((sum, item) => sum + item.queued + item.sending, 0);
  const failedTotal = emails.reduce((sum, item) => sum + item.failed, 0);
  const deliveredTotal = emails.reduce((sum, item) => sum + item.delivered, 0);

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Communications"
        title="Email queue"
        description="Send individually addressed messages in bounded batches. Acceptance by the provider and delivery confirmed by webhook are tracked separately."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/announcements">Announcements</Link>
          </Button>
        }
      />

      {warning ? <Phase3Notice tone="warning"><span className="flex flex-wrap items-center gap-2"><MailWarning className="size-4" /> {warning}</span></Phase3Notice> : null}
      <Phase3Notice tone="warning">
        <span className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="size-4" />
          Recipient addresses are visible only to PE Admin on this page. Messages are never sent with other students in CC.
        </span>
      </Phase3Notice>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Phase3Metric label="Accepted today" value={acceptedToday} detail="Provider-accepted messages (IST)" icon={CheckCircle2} tone="lime" />
        <Phase3Metric label="Awaiting send" value={queuedTotal} detail="Queued or in flight" icon={Inbox} tone="cobalt" />
        <Phase3Metric label="Webhook delivered" value={deliveredTotal} detail="Confirmed delivery events" icon={Send} />
        <Phase3Metric label="Failed" value={failedTotal} detail="Retryable up to three attempts" icon={MailWarning} tone="coral" />
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Email announcements</h2>
          <p className="text-xs text-ink-muted">Accepted means the provider took the message. Delivered requires a verified webhook event.</p>
        </div>
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Announcement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Daily cap</TableHead>
                <TableHead>Queued / sending</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead aria-label="Recipients" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-10 text-center text-sm text-ink-muted">
                    No email queues yet. Select “also queue individual emails” when publishing an announcement.
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((item) => (
                  <TableRow key={item.id} className={selected?.id === item.id ? "bg-cobalt/[0.04]" : undefined}>
                    <TableCell>
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">{item.audienceSummary ?? "Audience summary unavailable"}</p>
                    </TableCell>
                    <TableCell>
                      <Phase3StatusBadge
                        label={item.status}
                        tone={item.status === "completed" ? "good" : item.status === "failed" ? "bad" : "info"}
                      />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-ink-muted">{item.dailyLimit}/day</TableCell>
                    <TableCell className="text-xs tabular-nums text-ink-muted">{item.queued} / {item.sending}</TableCell>
                    <TableCell className="text-xs tabular-nums text-cobalt">{item.accepted}</TableCell>
                    <TableCell className="text-xs tabular-nums text-navy">{item.delivered}</TableCell>
                    <TableCell className="text-xs tabular-nums text-coral-dark">{item.failed}</TableCell>
                    <TableCell className="text-right text-xs font-bold">
                      <Link href={`/admin/notifications?email=${item.id}`} className="text-cobalt hover:underline">Recipients</Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {selected ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-2">
            <div>
              <h2 className="text-2xl font-bold">Queue controls</h2>
              <p className="mt-1 text-xs text-ink-muted">{selected.title}</p>
            </div>
            <EmailQueueActions
              emailAnnouncementId={selected.id}
              hasQueued={selected.queued + selected.sending > 0}
              hasFailed={selected.failed > 0}
            />
          </div>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient (PE Admin only)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-8 text-center text-sm text-ink-muted">No recipients in this queue.</TableCell>
                  </TableRow>
                ) : (
                  recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="text-xs font-semibold">{recipient.email}</TableCell>
                      <TableCell>
                        <Phase3StatusBadge
                          label={recipient.status}
                          tone={recipient.status === "delivered" ? "good" : recipient.status === "failed" || recipient.status === "bounced" ? "bad" : recipient.status === "accepted" ? "info" : "warn"}
                        />
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-ink-muted">{recipient.attempts}</TableCell>
                      <TableCell className="text-[11px] text-ink-muted">{recipient.acceptedAt ? recipient.acceptedAt.slice(0, 16).replace("T", " ") : "—"}</TableCell>
                      <TableCell className="text-[11px] text-ink-muted">{recipient.deliveredAt ? recipient.deliveredAt.slice(0, 16).replace("T", " ") : "—"}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-[11px] text-coral-dark" title={recipient.lastError ?? undefined}>
                        {recipient.lastError ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
