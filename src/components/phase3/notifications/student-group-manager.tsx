"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserMinus, UserPlus } from "lucide-react";
import { saveStudentGroup, setGroupMember } from "@/app/(admin)/admin/announcements/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import { NotificationActionNotice } from "./action-notice";

interface GroupMember {
  id: string;
  studentDirectoryId: string;
  fullName: string;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  members: GroupMember[];
}

export function StudentGroupManager({
  groups,
  students,
}: {
  groups: GroupRow[];
  students: Array<{ id: string; full_name: string; is_active: boolean }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "");
  const [newMemberId, setNewMemberId] = useState("");

  function reset() {
    setEditingId("");
    setName("");
    setDescription("");
    setIsActive(true);
  }

  function run(action: () => Promise<ActionState>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
      <div className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h3 className="text-xl font-bold">Groups</h3>
          <p className="mt-1 text-xs text-ink-muted">Select a group to manage its members from the student directory.</p>
        </div>
        {groups.length === 0 ? <p className="text-sm text-ink-muted">No groups yet. Create the first one alongside the form.</p> : null}
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className={`border p-4 ${group.id === activeGroup?.id ? "border-l-4 border-l-cobalt bg-cobalt/[0.04]" : "border-navy/10 bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-bold text-navy hover:underline"
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  {group.name}
                </button>
                <div className="flex items-center gap-2">
                  <Phase3StatusBadge label={group.isActive ? "active" : "inactive"} tone={group.isActive ? "good" : "neutral"} />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(group.id);
                      setName(group.name);
                      setDescription(group.description ?? "");
                      setIsActive(group.isActive);
                      setNotice(null);
                    }}
                  >
                    <Pencil /> Edit
                  </Button>
                </div>
              </div>
              {group.description ? <p className="mt-1 text-xs text-ink-muted">{group.description}</p> : null}
              {group.id === activeGroup?.id ? (
                <div className="mt-4 border-t border-navy/10 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Members ({group.members.length})</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.members.length === 0 ? <span className="text-xs text-ink-muted">No members yet.</span> : null}
                    {group.members.map((member) => (
                      <span key={member.id} className="inline-flex items-center gap-1 border border-navy/15 bg-white px-2 py-1 text-xs">
                        {member.fullName}
                        <button
                          type="button"
                          aria-label={`Remove ${member.fullName} from ${group.name}`}
                          className="text-coral-dark hover:underline"
                          disabled={pending}
                          onClick={() =>
                            run(() => setGroupMember({ groupId: group.id, studentDirectoryId: member.studentDirectoryId, member: false }))
                          }
                        >
                          <UserMinus className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="min-w-[220px] flex-1">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Add from directory</span>
                      <select
                        className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                        value={newMemberId}
                        onChange={(event) => setNewMemberId(event.target.value)}
                      >
                        <option value="">Choose student</option>
                        {students.filter((student) => student.is_active).map((student) => (
                          <option key={student.id} value={student.id}>{student.full_name}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !newMemberId}
                      onClick={() => {
                        run(() => setGroupMember({ groupId: group.id, studentDirectoryId: newMemberId, member: true }));
                        setNewMemberId("");
                      }}
                    >
                      <UserPlus /> Add member
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="border-l-4 border-l-lime bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-navy pb-3">
          <h3 className="text-xl font-bold">{editingId ? "Edit group" : "New group"}</h3>
          {editingId ? <Button type="button" variant="link" size="sm" onClick={reset}>Cancel</Button> : <Plus className="size-5 text-cobalt" />}
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Group name</span>
            <Input className="mt-2" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. PE Leaders 2026" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Description</span>
            <Textarea className="mt-2" rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="size-4 accent-[#3564e9]" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Active group
          </label>
          <NotificationActionNotice state={notice} />
          <Button
            type="button"
            variant="lime"
            className="w-full"
            disabled={pending || name.trim().length < 2}
            onClick={() =>
              run(async () => {
                const result = await saveStudentGroup({ id: editingId || undefined, name, description, isActive });
                if (result.status === "success" && result.groupId) setSelectedGroupId(result.groupId);
                return result;
              })
            }
          >
            {pending ? "Saving…" : editingId ? "Save changes" : "Create group"}
          </Button>
        </div>
      </div>
    </div>
  );
}
