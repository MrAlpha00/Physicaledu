import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getAdminTask, getAdminTaskSubmissions, getFilesForParent } from "@/lib/data/tasks";
import { getDepartmentOptions, getDirectoryRows } from "@/lib/data/admin";
import { TaskForm } from "@/components/tasks/task-form";
import { FileUpload } from "@/components/tasks/file-upload";
import { TaskSubmissionsPanel } from "@/components/tasks/task-submissions-panel";
import { TaskBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { audienceSummary } from "@/lib/operations/tasks";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Manage task" };

export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, submissions, referenceFiles, departments, directory] = await Promise.all([
    getAdminTask(taskId),
    getAdminTaskSubmissions(taskId),
    getFilesForParent("task_reference", taskId),
    getDepartmentOptions(),
    getDirectoryRows(),
  ]);
  if (!task) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/admin/classroom/tasks"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-cobalt"
      >
        <ArrowLeft className="size-3" /> All tasks
      </Link>

      <section className="flex flex-col gap-5 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Assignment detail</p>
          <h1 className="mt-3 text-4xl font-bold leading-none sm:text-5xl">{task.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
            <TaskBadge status={task.status} />
            <span>Due {formatIstDateTime(task.dueAt)}</span>
            <span>Priority: {task.priority}</span>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Audience: {audienceSummary(task.audiences).join(" · ")}
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline"><Pencil /> Edit task</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit task</DialogTitle>
              <DialogDescription>Updates are audited. Deadlines remain in Asia/Kolkata.</DialogDescription>
            </DialogHeader>
            <TaskForm
              task={task}
              departments={departments.map((item) => ({ id: item.id, label: `${item.code} — ${item.name}` }))}
              students={directory.map((item) => ({ id: item.id, label: `${item.usn} — ${item.fullName}` }))}
              onDone={() => window.location.reload()}
            />
          </DialogContent>
        </Dialog>
      </section>

      {task.description ? (
        <section className="border-l-4 border-l-cobalt bg-card p-6">
          <h2 className="eyebrow text-cobalt">Description</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 border-b-2 border-navy pb-3 text-2xl font-bold">Instructions</h2>
          <div className="space-y-4 text-sm text-navy/80">
            <p className="whitespace-pre-wrap">{task.instructions || "No additional instructions."}</p>
            <p className="border border-border p-3 text-xs">
              Submission requirements: {task.submissionRequirements || "None specified."}
            </p>
            <ul className="list-inside list-disc text-xs text-ink-muted">
              <li>Text responses: {task.allowText ? "allowed" : "not allowed"}</li>
              <li>File uploads: {task.allowFiles ? "allowed" : "not allowed"}</li>
              <li>Links: {task.allowLinks ? "allowed" : "not allowed"}</li>
            </ul>
          </div>
        </section>
        <section>
          <h2 className="mb-4 border-b-2 border-navy pb-3 text-2xl font-bold">Reference files</h2>
          <FileUpload
            parentType="task_reference"
            parentId={task.id}
            allowedTypes={task.allowedFileTypes}
            maxFileSizeBytes={task.maxFileSizeBytes}
            maxFiles={10}
            files={referenceFiles}
          />
        </section>
      </div>

      <section>
        <h2 className="mb-4 border-b-2 border-navy pb-3 text-2xl font-bold">Submissions</h2>
        <TaskSubmissionsPanel submissions={submissions} />
      </section>
    </div>
  );
}
