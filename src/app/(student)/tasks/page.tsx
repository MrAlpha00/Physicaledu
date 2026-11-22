import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyTasks } from "@/lib/data/tasks";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "My tasks" };

export default async function StudentTasksPage() {
  const user = await requireUser();
  const tasks = await getMyTasks(user);

  return (
    <div className="space-y-8">
      <section className="border-b-2 border-navy pb-5">
        <p className="eyebrow text-cobalt">Classroom / Assignments</p>
        <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">My tasks</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Tasks assigned to you, their deadlines and review status.
        </p>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No tasks assigned"
          description="Published tasks assigned to your account or PE group will appear here."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Deadline (IST)</TableHead>
                <TableHead>Your status</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-bold">{task.title}</TableCell>
                  <TableCell className="text-xs capitalize text-ink-muted">{task.category}</TableCell>
                  <TableCell className="text-xs">{formatIstDateTime(task.dueAt)}</TableCell>
                  <TableCell>
                    <TaskBadge status={task.submission?.displayStatus ?? "pending"} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-xs font-bold text-cobalt hover:underline"
                    >
                      Open
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
