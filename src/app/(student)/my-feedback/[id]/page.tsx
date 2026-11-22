import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Phase3Header, Phase3StatusBadge } from "@/components/phase3/common";
import { AttachmentLink } from "@/components/phase3/feedback/attachment-link";
import { FeedbackReplyForm } from "@/components/phase3/feedback/feedback-reply-form";
import { FeedbackThread } from "@/components/phase3/feedback/feedback-thread";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getFeedbackThread, getMyFeedbackRequests } from "@/lib/data/phase3-feedback";
import { createClient } from "@/lib/supabase/server";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "My feedback request" };

export default async function MyFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, supabase] = await Promise.all([requireUser(), createClient()]);
  const requests = await getMyFeedbackRequests();
  const request = requests.find((item) => item.id === id);
  if (!request) notFound();

  const [thread, filesResult] = await Promise.all([
    getFeedbackThread(id, user.id),
    supabase
      .from("phase3_files")
      .select("id, original_filename, upload_status")
      .eq("parent_type", "feedback_attachment")
      .eq("parent_id", id)
      .eq("upload_status", "confirmed")
      .order("created_at", { ascending: false }),
  ]);
  const files = (filesResult.data ?? []).map((file) => ({ id: file.id, name: file.original_filename }));
  const locked = request.status === "closed";

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="For students / My requests"
        title={request.subject}
        description="Only public replies from the PE department are shown here."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/my-feedback"><ArrowLeft /> My requests</Link>
          </Button>
        }
      />

      <section className="border border-navy/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Phase3StatusBadge label={request.status} tone={request.status === "resolved" ? "good" : "warn"} />
          <Phase3StatusBadge label={request.priority} tone={request.priority === "urgent" ? "bad" : "info"} />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow text-ink-muted">Category</dt>
            <dd className="mt-1 text-sm font-semibold capitalize">{request.category.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="eyebrow text-ink-muted">Submitted</dt>
            <dd className="mt-1 text-sm font-semibold">{formatIstDateTime(request.createdAt)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-ink-muted">Last updated</dt>
            <dd className="mt-1 text-sm font-semibold">{formatIstDateTime(request.updatedAt)}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-navy/10 pt-4">
          <p className="eyebrow text-ink-muted">Your description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
        </div>
        {files.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow text-ink-muted">Attachments</span>
            {files.map((file) => <AttachmentLink key={file.id} fileId={file.id} filename={file.name} />)}
          </div>
        ) : null}
        <div className="mt-5">
          <FileUploadControl
            name="extraAttachment"
            parentType="feedback_attachment"
            parentId={request.id}
            label="Add another attachment"
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="space-y-4">
          <div className="border-b-2 border-navy pb-2">
            <p className="eyebrow text-cobalt">Discussion</p>
            <h2 className="mt-1 text-2xl font-bold">Thread</h2>
          </div>
          <FeedbackThread replies={thread} isAdmin={false} />
        </section>
        <FeedbackReplyForm requestId={request.id} locked={locked} />
      </div>
    </div>
  );
}
