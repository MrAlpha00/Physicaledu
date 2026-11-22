"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstDate } from "@/lib/time/india";
import type { FeedbackCategory, FeedbackPriority, FeedbackStatus } from "@/types/database";
import type { FeedbackRequestView } from "@/types/domain";

const STATUSES: FeedbackStatus[] = [
  "submitted", "under_review", "in_progress", "waiting_for_student", "resolved", "rejected", "closed",
];
const CATEGORIES: FeedbackCategory[] = [
  "suggestion", "complaint", "equipment_request", "equipment_damage",
  "facility_issue", "sports_activity_request", "attendance_correction", "other",
];
const PRIORITIES: FeedbackPriority[] = ["low", "normal", "high", "urgent"];

function toneForStatus(status: FeedbackStatus) {
  if (["resolved"].includes(status)) return "good" as const;
  if (["rejected", "closed"].includes(status)) return "bad" as const;
  if (["in_progress", "under_review"].includes(status)) return "info" as const;
  return "warn" as const;
}

function toneForPriority(priority: FeedbackPriority) {
  if (priority === "urgent") return "bad" as const;
  if (priority === "high") return "warn" as const;
  if (priority === "low") return "neutral" as const;
  return "info" as const;
}

export function FeedbackList({
  requests,
  basePath,
  isAdmin,
}: {
  requests: FeedbackRequestView[];
  basePath: "/admin/feedback" | "/my-feedback";
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");

  const filtered = useMemo(
    () =>
      requests.filter(
        (request) =>
          (status === "all" || request.status === status) &&
          (category === "all" || request.category === category) &&
          (priority === "all" || request.priority === priority),
      ),
    [requests, status, category, priority],
  );

  const selectClass = "mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-xs";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 border border-navy/10 bg-white p-4 sm:grid-cols-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Status
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Category
          <select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Priority
          <select className={selectClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <p className="text-xs text-ink-muted">
        Showing {filtered.length} of {requests.length} request{requests.length === 1 ? "" : "s"}.
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No requests match these filters"
          description="Clear a filter to see more requests, or submit a new one from the feedback form."
          action={
            isAdmin ? undefined : (
              <Button asChild variant="lime"><Link href="/feedback">Submit feedback</Link></Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                {isAdmin ? <TableHead>Submitted by</TableHead> : null}
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Replies</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <p className="text-sm font-bold">{request.subject}</p>
                    <p className="mt-1 line-clamp-2 max-w-sm text-[11px] text-ink-muted">{request.description}</p>
                  </TableCell>
                  {isAdmin ? (
                    <TableCell>
                      <p className="text-xs font-bold">{request.studentName}</p>
                      <p className="text-[11px] text-ink-muted">{request.departmentName ?? "—"}</p>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-xs capitalize">{request.category.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <Phase3StatusBadge label={request.status} tone={toneForStatus(request.status)} />
                    {isAdmin && request.unreadForAdmin ? (
                      <span className="mt-1 block text-[10px] font-bold uppercase text-cobalt">Student replied</span>
                    ) : null}
                  </TableCell>
                  <TableCell><Phase3StatusBadge label={request.priority} tone={toneForPriority(request.priority)} /></TableCell>
                  <TableCell className="text-xs tabular-nums">{request.replyCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatIstDate(request.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline"><Link href={`${basePath}/${request.id}`}>Open</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
