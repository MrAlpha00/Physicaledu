import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ClipboardList, Plus } from "lucide-react";
import { getAdminTasks } from "@/lib/data/tasks";
import { getDepartmentOptions, getDirectoryRows } from "@/lib/data/admin";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { audienceSummary } from "@/lib/operations/tasks";
import { formatIstDate } from "@/lib/time/india";

export const metadata: Metadata = { title: "Class tasks" };

export default async function AdminTasksPage() {
  const [tasks, departments, directory] = await Promise.all([
    getAdminTasks(),
    getDepartmentOptions(),
    getDirectoryRows(),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Classroom / Tasks</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Assignments</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Publish tasks to students with explicit audience targeting and audited reviews.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex h-10 items-center gap-2 bg-lime px-5 text-xs font-bold uppercase tracking-[0.08em] text-navy transition-transform hover:-translate-y-0.5">
              <Plus className="size-4" /> New task
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create a class task</DialogTitle>
              <DialogDescription>
                Draft tasks stay hidden until published. Deadlines and times use Asia/Kolkata.
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              departments={departments.map((item) => ({ id: item.id, label: `${item.code} — ${item.name}` }))}
              students={directory.map((item) => ({ id: item.id, label: `${item.usn} — ${item.fullName}` }))}
              onDone={() => window.location.reload()}
            />
          </DialogContent>
        </Dialog>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks created"
          description="Create a draft or published task to assign work to PE students."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <HeadPlaceholder />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <p className="font-bold">{task.title}</p>
                    <p className="text-xs capitalize text-ink-muted">{task.category}</p>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-ink-muted">
                    {audienceSummary(task.audiences).join(" · ")}
                  </TableCell>
                  <TableCell className="text-xs">{formatIstDate(task.dueAt)}</TableCell>
                  <TableCell><TaskBadge status={task.status} /></TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/classroom/tasks/${task.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cobalt hover:underline"
                    >
                      Manage <ArrowUpRight className="size-3" />
                    </Link>
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

function HeadPlaceholder() {
  return <TableHead aria-label="Manage" />;
}
