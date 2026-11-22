"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveEquipmentCategory } from "@/app/(admin)/admin/equipment/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentCategoryView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field } from "./form-controls";

export function CategoryManager({ categories }: { categories: EquipmentCategoryView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  function reset() {
    setEditingId("");
    setName("");
    setDescription("");
    setSortOrder(0);
    setIsActive(true);
  }

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveEquipmentCategory({
        id: editingId || undefined,
        name,
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section className="overflow-x-auto border border-navy/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead aria-label="Edit" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-8 text-center text-sm text-ink-muted">
                  No categories yet. Create the first one using the form.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <p className="text-sm font-bold">{category.name}</p>
                    {category.description ? (
                      <p className="mt-1 max-w-md text-xs text-ink-muted">{category.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-ink-muted">{category.sortOrder}</TableCell>
                  <TableCell>
                    <Phase3StatusBadge label={category.isActive ? "active" : "inactive"} tone={category.isActive ? "good" : "neutral"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(category.id);
                        setName(category.name);
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
      </section>

      <section className="border-l-4 border-l-lime bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-navy pb-3">
          <h2 className="text-2xl font-bold">{editingId ? "Edit category" : "New category"}</h2>
          {editingId ? (
            <Button variant="link" size="sm" onClick={reset}>
              Cancel
            </Button>
          ) : (
            <Plus className="size-5 text-cobalt" />
          )}
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Category name" htmlFor="eq-category-name">
            <Input
              id="eq-category-name"
              className="mt-2"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Court equipment"
            />
          </Field>
          <Field label="Description" htmlFor="eq-category-description">
            <Textarea
              id="eq-category-description"
              className="mt-2"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sort order" htmlFor="eq-category-order">
              <Input
                id="eq-category-order"
                type="number"
                min={0}
                max={999}
                className="mt-2"
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value))}
              />
            </Field>
            <label className="flex items-end gap-2 pb-3 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          </div>
          <EquipmentActionNotice state={notice} />
          <Button disabled={pending || name.trim().length < 2} onClick={submit}>
            {pending ? "Saving…" : editingId ? "Save changes" : "Create category"}
          </Button>
        </div>
      </section>
    </div>
  );
}
