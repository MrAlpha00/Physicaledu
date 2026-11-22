import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wrench } from "lucide-react";
import { Phase3Header, Phase3StatusBadge } from "@/components/phase3/common";
import { AttachmentLink } from "@/components/phase3/feedback/attachment-link";
import { FeedbackThread } from "@/components/phase3/feedback/feedback-thread";
import { FeedbackUpdateForm } from "@/components/phase3/feedback/feedback-update-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getAdminFeedbackRequests, getFeedbackThread } from "@/lib/data/phase3-feedback";
import { createClient } from "@/lib/supabase/server";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Feedback request" };

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, requests, supabase] = await Promise.all([
    getCurrentUser(),
    getAdminFeedbackRequests(),
    createClient(),
  ]);
  const request = requests.find((item) => item.id === id);
  if (!request) notFound();

  const [thread, filesResult] = await Promise.all([
    getFeedbackThread(id, user?.id ?? null),
    supabase
      .from("phase3_files")
      .select("id, original_filename, upload_status")
      .eq("parent_type", "feedback_attachment")
      .eq("parent_id", id)
      .eq("upload_status", "confirmed")
      .order("created_at", { ascending: false }),
  ]);
  const files = (filesResult.data ?? []).map((file) => ({ id: file.id, name: file.original_filename }));
  const isDamage = request.category === "equipment_damage";

  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Submitted by", value: <>{request.studentName}{request.departmentName ? ` · ${request.departmentName}` : ""}</> },
    { label: "Category", value: request.category.replaceAll("_", " ") },
    { label: "Preferred response", value: request.preferredResponse?.replaceAll("_", " ") ?? "Not specified" },
    { label: "Submitted", value: formatIstDateTime(request.createdAt) },
    { label: "Last updated", value: formatIstDateTime(request.updatedAt) },
    { label: "Resolved", value: request.resolvedAt ? formatIstDateTime(request.resolvedAt) : "—" },
  ];

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Feedback"
        title={request.subject}
        description="Public replies, internal notes and status changes are all part of the same auditable thread."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/feedback"><ArrowLeft /> All requests</Link>
          </Button>
        }
      />

      <section className="border border-navy/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Phase3StatusBadge label={request.status} tone={request.status === "resolved" ? "good" : "warn"} />
          <Phase3StatusBadge label={request.priority} tone={request.priority === "urgent" ? "bad" : "info"} />
          {request.unreadForAdmin ? <Phase3StatusBadge label="student replied" tone="info" /> : null}
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="eyebrow text-ink-muted">{fact.label}</dt>
              <dd className="mt-1 text-sm font-semibold capitalize">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 border-t border-navy/10 pt-4">
          <p className="eyebrow text-ink-muted">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
        </div>
        {files.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow text-ink-muted">Attachments</span>
            {files.map((file) => <AttachmentLink key={file.id} fileId={file.id} filename={file.name} />)}
          </div>
        ) : null}
      </section>

      {isDamage ? (
        <section className="border-l-4 border-l-coral bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-coral-dark">Maintenance handoff</p>
              <h2 className="mt-1 text-xl font-bold">Equipment damage reference</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Use this request id as the source feedback id when raising a maintenance record. It is stored on the
                maintenance record for traceability.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/equipment/maintenance?source_feedback_id=${encodeURIComponent(request.id)}`}>
                <Wrench /> Open maintenance desk
              </Link>
            </Button>
          </div>
          <code className="mt-4 block select-all break-all border border-navy/15 bg-chalk/60 px-3 py-2 text-xs font-bold">
            {request.id}
          </code>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="space-y-4">
          <div className="border-b-2 border-navy pb-2">
            <p className="eyebrow text-cobalt">Discussion</p>
            <h2 className="mt-1 text-2xl font-bold">Thread</h2>
            <p className="mt-1 text-xs text-ink-muted">Internal notes are marked in coral and are never returned to students.</p>
          </div>
          <FeedbackThread replies={thread} isAdmin />
        </section>
        <FeedbackUpdateForm request={request} />
      </div>
    </div>
  );
}
