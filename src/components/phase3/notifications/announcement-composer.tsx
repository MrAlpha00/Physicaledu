"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2 } from "lucide-react";
import { saveAnnouncement } from "@/app/(admin)/admin/announcements/actions";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Phase3Notice } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationPriority } from "@/types/database";
import type { ActionState, DepartmentOption } from "@/types/domain";
import { NotificationActionNotice } from "./action-notice";

const AUDIENCE_TYPES = ["all_students", "active_pe", "department", "semester", "selected_students", "group"] as const;
type AudienceType = (typeof AUDIENCE_TYPES)[number];

interface AudienceRow {
  audienceType: AudienceType;
  departmentId: string;
  semester: string;
  studentDirectoryId: string;
  groupId: string;
}

function audienceLabel(row: AudienceRow, departments: DepartmentOption[], students: Array<{ id: string; full_name: string }>, groups: Array<{ id: string; name: string }>): string {
  switch (row.audienceType) {
    case "all_students": return "All students";
    case "active_pe": return "Active PE students";
    case "department": return `Department ${departments.find((item) => item.id === row.departmentId)?.code ?? (row.departmentId || "—")}`;
    case "semester": return `Semester ${row.semester || "—"}`;
    case "selected_students": return students.find((item) => item.id === row.studentDirectoryId)?.full_name ?? "Choose a student";
    case "group": return groups.find((item) => item.id === row.groupId)?.name ?? "Choose a group";
  }
}

export function AnnouncementComposer({
  departments,
  groups,
  students,
  emailWarning,
}: {
  departments: DepartmentOption[];
  groups: Array<{ id: string; name: string; isActive: boolean }>;
  students: Array<{ id: string; full_name: string }>;
  emailWarning: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [sendEmail, setSendEmail] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("100");
  const [audiences, setAudiences] = useState<AudienceRow[]>([{ audienceType: "all_students", departmentId: "", semester: "", studentDirectoryId: "", groupId: "" }]);
  const [uploadParentId, setUploadParentId] = useState("");

  // The upload needs a parent id before the announcement exists. Generate it on
  // the client only so server and markup never disagree during hydration.
  useEffect(() => {
    setUploadParentId(crypto.randomUUID());
  }, []);

  function updateAudience(index: number, patch: Partial<AudienceRow>) {
    setAudiences((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const attachmentFileId = String(new FormData(event.currentTarget).get("announcementAttachment") ?? "");
    startTransition(async () => {
      const result = await saveAnnouncement({
        title,
        message,
        link,
        priority,
        attachmentFileId,
        sendEmail,
        dailyLimit: Number(dailyLimit),
        audiences: audiences.map((row) => ({
          audienceType: row.audienceType,
          departmentId: row.departmentId,
          semester: row.semester === "" ? "" : Number(row.semester),
          studentDirectoryId: row.studentDirectoryId,
          groupId: row.groupId,
        })),
      });
      setNotice(result);
      if (result.status === "success") {
        setTitle("");
        setMessage("");
        setLink("");
        setSendEmail(false);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
      <div>
        <p className="eyebrow text-cobalt">New announcement</p>
        <h2 className="mt-1 text-2xl font-bold">Compose &amp; publish</h2>
        <p className="mt-1 text-xs text-ink-muted">In-app notifications are created immediately. Email is optional and sent in bounded batches.</p>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Title</span>
        <Input className="mt-2" required minLength={5} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Inter-house athletics practice" />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Message</span>
        <Textarea className="mt-2" required minLength={10} maxLength={4000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Link (optional)</span>
          <Input className="mt-2" maxLength={500} value={link} onChange={(event) => setLink(event.target.value)} placeholder="/calendar" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Priority</span>
          <select
            className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as NotificationPriority)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <div className="border-t border-navy/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-cobalt">Audiences</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAudiences((rows) => [...rows, { audienceType: "all_students", departmentId: "", semester: "", studentDirectoryId: "", groupId: "" }])}
          >
            <Plus /> Add audience
          </Button>
        </div>
        <div className="mt-3 space-y-4">
          {audiences.map((row, index) => (
            <div key={index} className="space-y-3 border border-navy/10 bg-chalk/40 p-3">
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Audience {index + 1}</span>
                  <select
                    className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                    value={row.audienceType}
                    onChange={(event) =>
                      updateAudience(index, {
                        audienceType: event.target.value as AudienceType,
                        departmentId: "", semester: "", studentDirectoryId: "", groupId: "",
                      })
                    }
                  >
                    {AUDIENCE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove audience ${index + 1}`}
                  disabled={audiences.length === 1}
                  onClick={() => setAudiences((rows) => rows.filter((_, position) => position !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
              {row.audienceType === "department" ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Department</span>
                  <select
                    className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                    value={row.departmentId}
                    onChange={(event) => updateAudience(index, { departmentId: event.target.value })}
                  >
                    <option value="">Choose department</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
                  </select>
                </label>
              ) : null}
              {row.audienceType === "semester" ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Semester</span>
                  <Input className="mt-2" type="number" min={1} max={12} value={row.semester} onChange={(event) => updateAudience(index, { semester: event.target.value })} />
                </label>
              ) : null}
              {row.audienceType === "selected_students" ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Student</span>
                  <select
                    className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                    value={row.studentDirectoryId}
                    onChange={(event) => updateAudience(index, { studentDirectoryId: event.target.value })}
                  >
                    <option value="">Choose student</option>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}
                  </select>
                </label>
              ) : null}
              {row.audienceType === "group" ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Student group</span>
                  <select
                    className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                    value={row.groupId}
                    onChange={(event) => updateAudience(index, { groupId: event.target.value })}
                  >
                    <option value="">Choose group</option>
                    {groups.filter((group) => group.isActive).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              ) : null}
              <p className="text-[11px] text-ink-muted">{audienceLabel(row, departments, students, groups)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-navy/10 pt-4">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="size-4 accent-[#3564e9]"
            checked={sendEmail}
            onChange={(event) => setSendEmail(event.target.checked)}
          />
          Also queue individual emails
        </label>
        {sendEmail ? (
          <>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Daily send limit (1–100)</span>
              <Input className="mt-2" type="number" min={1} max={100} value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} />
            </label>
            {emailWarning ? <Phase3Notice tone="warning">{emailWarning}</Phase3Notice> : null}
          </>
        ) : null}
      </div>

      {uploadParentId ? (
        <FileUploadControl
          name="announcementAttachment"
          parentType="announcement_attachment"
          parentId={uploadParentId}
          label="Attachment (optional, private)"
        />
      ) : null}

      <NotificationActionNotice state={notice} />
      <Button type="submit" variant="lime" className="w-full" disabled={pending || title.trim().length < 5 || message.trim().length < 10}>
        <Send /> {pending ? "Publishing…" : "Publish announcement"}
      </Button>
    </form>
  );
}
