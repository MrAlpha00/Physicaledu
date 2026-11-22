import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Paperclip } from "lucide-react";
import { getFilesForParent, getMyTask } from "@/lib/data/tasks";
import { TaskSubmissionForm } from "@/components/tasks/task-submission-form";
import { FileUpload } from "@/components/tasks/file-upload";
import { TaskBadge } from "@/components/shared/status-badge";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Task detail" };

export default async function StudentTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, referenceFiles] = await Promise.all([
    getMyTask(taskId),
    getFilesForParent("task_reference", taskId),
  ]);
  if (!task) notFound();

  const submissionFiles = task.submission
    ? await getFilesForParent("task_submission", task.submission.id)
    : [];
  return (
    <div className="space-y-8">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-cobalt"
      >
        <ArrowLeft className="size-3" /> My tasks
      </Link>

      <section className="border-b-2 border-navy pb-6">
        <p className="eyebrow text-cobalt">Assignment</p>
        <h1 className="mt-3 text-4xl font-bold leading-none sm:text-5xl">{task.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <TaskBadge status={task.submission?.displayStatus ?? "pending"} />
          <span>Due {formatIstDateTime(task.dueAt)}</span>
          <span className="capitalize">Priority: {task.priority}</span>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <div>
            <h2 className="mb-3 border-b-2 border-navy pb-2 text-2xl font-bold">Details</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
          </div>
          {task.instructions ? (
            <div className="border-l-4 border-l-cobalt bg-cobalt/5 p-4 text-sm">
              <p className="eyebrow text-cobalt">Instructions</p>
              <p className="mt-2 whitespace-pre-wrap">{task.instructions}</p>
            </div>
          ) : null}
          {task.submissionRequirements ? (
            <p className="border border-border p-4 text-xs">
              <span className="font-bold">Requirements:</span> {task.submissionRequirements}
            </p>
          ) : null}
          {referenceFiles.length ? (
            <div>
              <h3 className="eyebrow mb-2 flex items-center gap-2 text-ink-muted">
                <Paperclip className="size-3" /> Reference material
              </h3>
              <FileUpload
                parentType="task_reference"
                parentId={task.id}
                allowedTypes={task.allowedFileTypes}
                maxFileSizeBytes={task.maxFileSizeBytes}
                maxFiles={0}
                files={referenceFiles}
              />
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-3 border-b-2 border-navy pb-2 text-2xl font-bold">Your submission</h2>
          <TaskSubmissionForm task={task} />
          {task.allowFiles && task.submission ? (
            <div className="mt-6">
              <h3 className="eyebrow mb-3 text-ink-muted">Attached files</h3>
              <FileUpload
                parentType="task_submission"
                parentId={task.submission.id}
                allowedTypes={task.allowedFileTypes}
                maxFileSizeBytes={task.maxFileSizeBytes}
                maxFiles={task.maxFiles}
                files={submissionFiles}
              />
            </div>
          ) : null}
          {task.allowFiles && !task.submission ? (
            <p className="mt-6 border border-dashed border-border p-4 text-xs text-ink-muted">
              Save a draft or submit your response first, then attach files.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
