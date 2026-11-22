"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveGameRuleCategory } from "@/app/(admin)/admin/game-rules/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import { CmsActionNotice } from "./action-notice";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function GameRuleCategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  function reset() {
    setEditingId("");
    setName("");
    setSlug("");
    setDescription("");
    setSortOrder(0);
    setIsActive(true);
  }

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveGameRuleCategory({
        id: editingId || undefined,
        name,
        slug,
        description,
        sortOrder,
        isActive,
      });
      setNotice(result);
      if (result.status === "success") {
        reset();
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
      <div className="overflow-x-auto border border-navy/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead aria-label="Edit" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-sm text-ink-muted">
                  No categories yet. Create the first one alongside the form.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <p className="text-sm font-bold">{category.name}</p>
                    {category.description ? <p className="mt-1 text-xs text-ink-muted">{category.description}</p> : null}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-ink-muted">{category.slug}</TableCell>
                  <TableCell className="text-xs tabular-nums text-ink-muted">{category.sortOrder}</TableCell>
                  <TableCell>
                    <Phase3StatusBadge label={category.isActive ? "active" : "inactive"} tone={category.isActive ? "good" : "neutral"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(category.id);
                        setName(category.name);
                        setSlug(category.slug);
                        setDescription(category.description ?? "");
                        setSortOrder(category.sortOrder);
                        setIsActive(category.isActive);
                        setNotice(null);
                      }}
                    >
                      <Pencil /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-l-4 border-l-lime bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-navy pb-3">
          <h3 className="text-xl font-bold">{editingId ? "Edit category" : "New category"}</h3>
          {editingId ? (
            <Button type="button" variant="link" size="sm" onClick={reset}>Cancel</Button>
          ) : (
            <Plus className="size-5 text-cobalt" />
          )}
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Name</span>
            <Input className="mt-2" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Team games" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Slug</span>
            <Input className="mt-2" maxLength={80} value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="team-games" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Description</span>
            <Textarea className="mt-2" rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Sort order</span>
              <Input className="mt-2" type="number" min={0} max={999} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#3564e9]"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          </div>
          <CmsActionNotice state={notice} />
          <Button type="button" variant="lime" className="w-full" disabled={pending || name.trim().length < 2} onClick={submit}>
            {pending ? "Saving…" : editingId ? "Save changes" : "Create category"}
          </Button>
        </div>
      </div>
    </div>
  );
}
