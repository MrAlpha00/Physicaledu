"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { submitVisitorEntry } from "@/app/(public)/visit/[token]/actions";
import { TurnstileWidget } from "@/components/visitor/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VisitorPurpose } from "@/types/domain";

export function VisitorForm({
  token,
  purposes,
  departments,
  isAuthenticated,
  turnstileSiteKey,
}: {
  token: string;
  purposes: VisitorPurpose[];
  departments: Array<{ id: string; code: string; name: string }>;
  isAuthenticated: boolean;
  turnstileSiteKey: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const onTurnstileToken = useCallback((value: string) => setTurnstileToken(value), []);
  const [form, setForm] = useState({
    fullName: "",
    usn: "",
    departmentId: "",
    academicYear: "",
    semester: "",
    purposeId: "",
    purposeDetail: "",
    description: "",
    honeypot: "",
  });

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await submitVisitorEntry({
        token,
        fullName: form.fullName,
        usn: form.usn,
        departmentId: form.departmentId || null,
        academicYear: form.academicYear ? Number(form.academicYear) : null,
        semester: form.semester ? Number(form.semester) : null,
        purposeId: form.purposeId,
        purposeDetail: form.purposeDetail,
        description: form.description,
        honeypot: form.honeypot,
        turnstileToken,
      });
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") setDone(true);
    });
  }

  if (done) {
    return (
      <div className="border-l-4 border-l-[#8fb63c] bg-lime/40 p-8">
        <CheckCircle2 className="size-9 text-[#4b711d]" />
        <h2 className="mt-4 text-3xl font-bold">Entry recorded</h2>
        <p className="mt-3 text-sm text-[#33521b]">
          Thank you. Your visit has been added to the PE department register.
        </p>
        <Link href="/visitors/today" className="mt-5 inline-block text-sm font-bold text-cobalt underline">
          View today&apos;s visitors
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAuthenticated ? (
        <p className="border-l-4 border-l-cobalt bg-cobalt/5 p-4 text-sm">
          You are signed in. Your name, USN, department and semester are taken from your verified
          account and official record.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="visitor-name">Full name</Label>
            <Input
              id="visitor-name"
              className="mt-2"
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="visitor-usn">USN (optional)</Label>
            <Input
              id="visitor-usn"
              className="mt-2"
              value={form.usn}
              onChange={(event) => setForm((current) => ({ ...current, usn: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="visitor-department">Department (optional)</Label>
            <select
              id="visitor-department"
              className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
              value={form.departmentId}
              onChange={(event) =>
                setForm((current) => ({ ...current, departmentId: event.target.value }))
              }
            >
              <option value="">Select</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="visitor-year">Academic year (optional)</Label>
            <Input
              id="visitor-year"
              type="number"
              min={1}
              max={6}
              className="mt-2"
              value={form.academicYear}
              onChange={(event) =>
                setForm((current) => ({ ...current, academicYear: event.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="visitor-semester">Semester (optional)</Label>
            <Input
              id="visitor-semester"
              type="number"
              min={1}
              max={12}
              className="mt-2"
              value={form.semester}
              onChange={(event) =>
                setForm((current) => ({ ...current, semester: event.target.value }))
              }
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="visitor-purpose">Purpose of visit</Label>
        <select
          id="visitor-purpose"
          className="mt-2 h-11 w-full border border-input bg-card px-3 text-sm"
          value={form.purposeId}
          onChange={(event) => setForm((current) => ({ ...current, purposeId: event.target.value }))}
        >
          <option value="">Select a purpose</option>
          {purposes.map((purpose) => (
            <option key={purpose.id} value={purpose.id}>
              {purpose.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="visitor-detail">If Other, describe your purpose</Label>
        <Input
          id="visitor-detail"
          className="mt-2"
          value={form.purposeDetail}
          maxLength={500}
          onChange={(event) =>
            setForm((current) => ({ ...current, purposeDetail: event.target.value }))
          }
        />
      </div>
      <div>
        <Label htmlFor="visitor-description">Additional notes (optional)</Label>
        <Textarea
          id="visitor-description"
          className="mt-2"
          rows={3}
          maxLength={1000}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="visitor-website">Leave this field empty</label>
        <input
          id="visitor-website"
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(event) => setForm((current) => ({ ...current, honeypot: event.target.value }))}
        />
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
      ) : null}

      {notice ? (
        <p role="status" className={`border-l-4 p-4 text-sm ${notice.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {notice.text}
        </p>
      ) : null}

      <Button variant="lime" size="lg" disabled={pending || !form.purposeId} onClick={submit}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Sign visitor register
      </Button>
    </div>
  );
}
