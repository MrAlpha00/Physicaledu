"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { saveClassTask } from "@/app/(admin)/admin/classroom/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { audienceSummary, validateAudiences } from "@/lib/operations/tasks";
import { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_FILE_BYTES } from "@/lib/storage/file-validation";
import { istLocalInputToIso, toIstLocalInput } from "@/lib/time/india";
import type { AudienceType } from "@/types/database";
import type { ClassTaskView, TaskAudienceInput } from "@/types/domain";
import type { ClassTaskInput } from "@/lib/validations/phase2";

interface Option {
  id: string;
  label: string;
}

// Stable module-level defaults keep the component render pure.
const DEFAULT_STARTS_AT = toIstLocalInput(new Date());
const DEFAULT_DUE_AT = toIstLocalInput(new Date(Date.now() + 7 * 86_400_000));

const AUDIENCE_OPTIONS: Array<{ value: AudienceType; label: string }> = [
  { value: "all_students", label: "All registered students" },
  { value: "active_pe", label: "Active PE students" },
  { value: "department", label: "Department" },
  { value: "semester", label: "Semester" },
  { value: "selected_students", label: "Selected students" },
];

export function TaskForm({
  departments,
  students,
  task,
  onDone,
}: {
  departments: Option[];
  students: Option[];
  task?: ClassTaskView | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<ClassTaskInput>({
    id: task?.id,
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: task?.category ?? "general",
    startsAt: task ? toIstLocalInput(task.startsAt) : DEFAULT_STARTS_AT,
    dueAt: task ? toIstLocalInput(task.dueAt) : DEFAULT_DUE_AT,
    priority: task?.priority ?? "normal",
    instructions: task?.instructions ?? "",
    submissionRequirements: task?.submissionRequirements ?? "",
    allowText: task?.allowText ?? true,
    allowFiles: task?.allowFiles ?? true,
    allowLinks: task?.allowLinks ?? false,
    maxFileSizeBytes: task?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_BYTES,
    allowedFileTypes: task?.allowedFileTypes ?? DEFAULT_ALLOWED_TYPES,
    maxFiles: task?.maxFiles ?? 10,
    status: task?.status ?? "draft",
    audiences: task?.audiences ?? [{ audience_type: "active_pe" }],
  });

  function update<K extends keyof ClassTaskInput>(key: K, value: ClassTaskInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateAudience(index: number, patch: Partial<TaskAudienceInput>) {
    setForm((current) => ({
      ...current,
      audiences: current.audiences.map((audience, position) =>
        position === index ? { ...audience, ...patch } : audience,
      ),
    }));
  }

  function submit() {
    setMessage(null);
    const audienceIssue = validateAudiences(form.audiences);
    if (audienceIssue) {
      setMessage({ tone: "error", text: audienceIssue });
      return;
    }
    if (new Date(form.dueAt) <= new Date(form.startsAt)) {
      setMessage({ tone: "error", text: "The deadline must be after the start date." });
      return;
    }
    startTransition(async () => {
      const result = await saveClassTask({
        ...form,
        startsAt: istLocalInputToIso(form.startsAt),
        dueAt: istLocalInputToIso(form.dueAt),
      });
      setMessage({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") onDone();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="task-title">Task title</Label>
          <Input
            id="task-title"
            className="mt-2"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            className="mt-2"
            rows={4}
            value={form.description ?? ""}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="task-starts">Starts (IST)</Label>
          <Input
            id="task-starts"
            type="datetime-local"
            className="mt-2"
            value={form.startsAt}
            onChange={(event) => update("startsAt", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="task-due">Deadline (IST)</Label>
          <Input
            id="task-due"
            type="datetime-local"
            className="mt-2"
            value={form.dueAt}
            onChange={(event) => update("dueAt", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="task-category">Category</Label>
          <Input
            id="task-category"
            className="mt-2"
            value={form.category ?? ""}
            onChange={(event) => update("category", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="task-priority">Priority</Label>
          <select
            id="task-priority"
            className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
            value={form.priority}
            onChange={(event) => update("priority", event.target.value as ClassTaskInput["priority"])}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="task-instructions">Instructions</Label>
          <Textarea
            id="task-instructions"
            className="mt-2"
            rows={3}
            value={form.instructions ?? ""}
            onChange={(event) => update("instructions", event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="task-requirements">Submission requirements</Label>
          <Textarea
            id="task-requirements"
            className="mt-2"
            rows={3}
            value={form.submissionRequirements ?? ""}
            onChange={(event) => update("submissionRequirements", event.target.value)}
          />
        </div>
      </div>

      <fieldset className="border border-border p-4">
        <legend className="eyebrow px-2 text-cobalt">Submission methods</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["allowText", "Text response"],
            ["allowFiles", "File uploads"],
            ["allowLinks", "External links"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={form[key]}
                onChange={(event) => update(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        {form.allowFiles ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="task-max-files">Maximum files</Label>
              <Input
                id="task-max-files"
                type="number"
                min={0}
                max={10}
                className="mt-2"
                value={form.maxFiles}
                onChange={(event) => update("maxFiles", Number(event.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="task-max-size">Max size (MB)</Label>
              <Input
                id="task-max-size"
                type="number"
                min={1}
                max={100}
                className="mt-2"
                value={Math.round(form.maxFileSizeBytes / (1024 * 1024))}
                onChange={(event) =>
                  update("maxFileSizeBytes", Number(event.target.value) * 1024 * 1024)
                }
              />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="task-file-types">Allowed extensions (comma separated)</Label>
              <Input
                id="task-file-types"
                className="mt-2"
                value={form.allowedFileTypes.join(", ")}
                onChange={(event) =>
                  update(
                    "allowedFileTypes",
                    event.target.value
                      .split(",")
                      .map((value) => value.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="border border-border p-4">
        <legend className="eyebrow px-2 text-cobalt">Target audience</legend>
        <p className="mb-4 text-xs text-ink-muted">
          Audience rows are combined with OR: a student sees the task if any row matches.
        </p>
        <div className="space-y-3">
          {form.audiences.map((audience, index) => (
            <div key={index} className="grid gap-3 border border-border bg-card/60 p-3 sm:grid-cols-[1.2fr_1fr_auto]">
              <div>
                <Label>Audience type</Label>
                <select
                  className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
                  value={audience.audience_type}
                  onChange={(event) =>
                    updateAudience(index, {
                      audience_type: event.target.value as AudienceType,
                      department_id: null,
                      semester: null,
                      student_directory_id: null,
                    })
                  }
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {audience.audience_type === "department" ? (
                <div>
                  <Label>Department</Label>
                  <select
                    className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
                    value={audience.department_id ?? ""}
                    onChange={(event) => updateAudience(index, { department_id: event.target.value })}
                  >
                    <option value="">Select</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {audience.audience_type === "semester" ? (
                <div>
                  <Label>Semester</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="mt-2"
                    value={audience.semester ?? ""}
                    onChange={(event) => updateAudience(index, { semester: Number(event.target.value) || null })}
                  />
                </div>
              ) : null}
              {audience.audience_type === "selected_students" ? (
                <div>
                  <Label>Student</Label>
                  <select
                    className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
                    value={audience.student_directory_id ?? ""}
                    onChange={(event) =>
                      updateAudience(index, { student_directory_id: event.target.value })
                    }
                  >
                    <option value="">Select</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={form.audiences.length === 1}
                  onClick={() =>
                    update(
                      "audiences",
                      form.audiences.filter((_, position) => position !== index),
                    )
                  }
                  aria-label="Remove audience"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => update("audiences", [...form.audiences, { audience_type: "all_students" }])}
        >
          <Plus /> Add audience
        </Button>
        <p className="mt-3 text-xs text-ink-muted">
          {audienceSummary(form.audiences).join(" · ")}
        </p>
      </fieldset>

      <div>
        <Label htmlFor="task-status">Publish state</Label>
        <select
          id="task-status"
          className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
          value={form.status}
          onChange={(event) => update("status", event.target.value as ClassTaskInput["status"])}
        >
          <option value="draft">Draft — hidden from students</option>
          <option value="published">Published — accepting submissions</option>
          <option value="closed">Closed — no new submissions</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {message ? (
        <p role="status" className={`text-sm ${message.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save task
        </Button>
      </div>
    </div>
  );
}
