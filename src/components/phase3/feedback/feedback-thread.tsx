import { LockKeyhole } from "lucide-react";
import { formatIstDateTime } from "@/lib/time/india";
import type { FeedbackReplyView } from "@/types/domain";

/** Internal replies are filtered by RLS and again here for non-admin views. */
export function FeedbackThread({
  replies,
  isAdmin,
}: {
  replies: FeedbackReplyView[];
  isAdmin: boolean;
}) {
  const visible = isAdmin ? replies : replies.filter((reply) => !reply.isInternal);

  if (visible.length === 0) {
    return (
      <p className="border border-dashed border-navy/20 bg-white/50 px-5 py-8 text-center text-sm text-ink-muted">
        No replies yet. {isAdmin ? "Add a public response or an internal note to start the thread." : "The department will reply here."}
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {visible.map((reply) => {
        const fromStudent = isAdmin && !reply.isInternal && reply.isMine === false;
        return (
          <li
            key={reply.id}
            className={`border-l-4 bg-white p-4 shadow-sm ${
              reply.isInternal
                ? "border-l-coral"
                : fromStudent
                  ? "border-l-cobalt"
                  : "border-l-lime"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {reply.isMine ? "You" : reply.authorName}
                {reply.isInternal ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-coral-dark">
                    <LockKeyhole className="size-3" /> Internal note
                  </span>
                ) : null}
              </p>
              <time className="text-[11px] text-ink-muted" dateTime={reply.createdAt}>
                {formatIstDateTime(reply.createdAt)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy/85">{reply.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
