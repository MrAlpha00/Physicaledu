"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveGameRulePost } from "@/app/(admin)/admin/game-rules/actions";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Phase3Notice } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GameRuleStatus } from "@/types/database";
import type { ActionState } from "@/types/domain";
import type { GameRulePostInput } from "@/lib/validations/phase3";
import { CmsActionNotice } from "./action-notice";
import { GameRuleBlocks } from "./game-rule-blocks";
import {
  BLOCK_TYPE_LABELS,
  GAME_RULE_BLOCK_TYPES,
  createBlockDraft,
  draftToBlock,
  validateBlockDraft,
  type BlockDraft,
  type GalleryEntryDraft,
} from "./game-rule-block-content";

export interface GameRulePostInitialValue {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  status: GameRuleStatus;
  introduction: string;
  history: string;
  aboutGame: string;
  howToPlay: string;
  rulesText: string;
  equipmentRequired: string;
  playersCount: string;
  playingArea: string;
  instructions: string;
  safetyInstructions: string;
  videoUrls: string[];
  isFeatured: boolean;
  isPinned: boolean;
  blocks: BlockDraft[];
}

function EditorField({
  label,
  value,
  onChange,
  rows = 4,
  maxLength = 4000,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">{label}</span>
      <Textarea
        className="mt-2"
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function GameRulePostEditor({
  initial,
  categories,
}: {
  initial: GameRulePostInitialValue | null;
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [status, setStatus] = useState<GameRuleStatus>(initial?.status ?? "draft");
  const [introduction, setIntroduction] = useState(initial?.introduction ?? "");
  const [history, setHistory] = useState(initial?.history ?? "");
  const [aboutGame, setAboutGame] = useState(initial?.aboutGame ?? "");
  const [howToPlay, setHowToPlay] = useState(initial?.howToPlay ?? "");
  const [rulesText, setRulesText] = useState(initial?.rulesText ?? "");
  const [equipmentRequired, setEquipmentRequired] = useState(initial?.equipmentRequired ?? "");
  const [playersCount, setPlayersCount] = useState(initial?.playersCount ?? "");
  const [playingArea, setPlayingArea] = useState(initial?.playingArea ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [safetyInstructions, setSafetyInstructions] = useState(initial?.safetyInstructions ?? "");
  const [videoUrls, setVideoUrls] = useState<string[]>(initial?.videoUrls ?? []);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [blocks, setBlocks] = useState<BlockDraft[]>(initial?.blocks ?? []);
  const [newBlockType, setNewBlockType] = useState<(typeof GAME_RULE_BLOCK_TYPES)[number]>("paragraph");

  const postId = initial?.id ?? "";

  function updateBlock(index: number, patch: Partial<BlockDraft>) {
    setBlocks((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((row, position) => ({ ...row, sortOrder: position }));
    });
  }

  function removeBlock(index: number) {
    setBlocks((rows) => rows.filter((_, position) => position !== index).map((row, position) => ({ ...row, sortOrder: position })));
  }

  function addBlock() {
    setBlocks((rows) => [...rows, createBlockDraft(newBlockType, rows.length)]);
  }

  function updateGalleryEntry(blockIndex: number, entryIndex: number, patch: Partial<GalleryEntryDraft>) {
    setBlocks((rows) =>
      rows.map((row, position) =>
        position === blockIndex
          ? { ...row, gallery: row.gallery.map((entry, index) => (index === entryIndex ? { ...entry, ...patch } : entry)) }
          : row,
      ),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = new FormData(event.currentTarget);

    const prepared = blocks.map((draft, index) => {
      const next: BlockDraft = {
        ...draft,
        sortOrder: index,
        gallery: draft.gallery.map((entry) => ({ ...entry })),
      };
      if (next.blockType === "image" || next.blockType === "resource") {
        const uploaded = String(form.get(`block-file-${index}`) ?? "");
        if (uploaded) next.fileId = uploaded;
      }
      if (next.blockType === "image_gallery") {
        next.gallery = next.gallery.map((entry, entryIndex) => {
          const uploaded = String(form.get(`gallery-file-${index}-${entryIndex}`) ?? "");
          return uploaded ? { ...entry, file_id: uploaded } : entry;
        });
      }
      return next;
    });

    for (const draft of prepared) {
      const issue = validateBlockDraft(draft);
      if (issue) {
        setNotice({ status: "error", message: `Block ${draft.sortOrder + 1}: ${issue}` });
        return;
      }
    }

    const input: GameRulePostInput = {
      id: initial?.id,
      title,
      slug,
      categoryId,
      introduction,
      history,
      aboutGame,
      howToPlay,
      rulesText,
      equipmentRequired,
      playersCount,
      playingArea,
      instructions,
      safetyInstructions,
      videoUrls,
      status,
      isFeatured,
      isPinned,
      blocks: prepared.map(draftToBlock),
    };

    startTransition(async () => {
      const result = await saveGameRulePost(input);
      setNotice(result);
      if (result.status === "success") {
        if (!initial?.id && result.postId) router.push(`/admin/game-rules/${result.postId}`);
        else router.refresh();
      }
    });
  }

  const previewBlocks = blocks.map((draft, index) => ({
    id: `preview-${index}`,
    blockType: draft.blockType,
    content: draftToBlock(draft).content,
    sortOrder: index,
  }));

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
          <div>
            <p className="eyebrow text-cobalt">Article details</p>
            <h2 className="mt-1 text-2xl font-bold">{initial ? "Edit game rule" : "New game rule"}</h2>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Title</span>
            <Input className="mt-2" required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Slug</span>
            <Input
              className="mt-2"
              required
              maxLength={140}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="e.g. basketball-basics"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Category</span>
              <select
                className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Status</span>
              <select
                className="mt-2 h-10 w-full border border-navy/20 bg-white px-3 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as GameRuleStatus)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-6 border-t border-navy/10 pt-4">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-4 accent-[#c8f169]" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-4 accent-[#3564e9]" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />
              Pinned
            </label>
          </div>
          {status !== "published" ? (
            <Phase3Notice tone="warning">Only published rules are visible on the public site. Drafts and archived articles stay private.</Phase3Notice>
          ) : null}
        </div>

        <div className="space-y-5 border-t-4 border-lime bg-white p-6 shadow-sm">
          <p className="eyebrow text-cobalt">Written sections</p>
          <EditorField label="Summary / introduction" value={introduction} onChange={setIntroduction} rows={3} maxLength={1500} />
          <EditorField label="History" value={history} onChange={setHistory} maxLength={4000} />
          <EditorField label="About the game" value={aboutGame} onChange={setAboutGame} maxLength={4000} />
          <EditorField label="How to play" value={howToPlay} onChange={setHowToPlay} rows={6} maxLength={6000} />
          <EditorField label="Rules" value={rulesText} onChange={setRulesText} rows={6} maxLength={6000} />
          <EditorField label="Equipment" value={equipmentRequired} onChange={setEquipmentRequired} maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Players</span>
              <Input className="mt-2" maxLength={80} value={playersCount} onChange={(event) => setPlayersCount(event.target.value)} placeholder="e.g. 5 per side" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Playing area</span>
              <Input className="mt-2" maxLength={500} value={playingArea} onChange={(event) => setPlayingArea(event.target.value)} placeholder="e.g. 28m × 15m court" />
            </label>
          </div>
          <EditorField label="Instructions" value={instructions} onChange={setInstructions} rows={6} maxLength={6000} />
          <EditorField label="Safety" value={safetyInstructions} onChange={setSafetyInstructions} rows={4} maxLength={3000} />
        </div>
      </div>

      <section className="border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
          <div>
            <p className="eyebrow text-cobalt">Media</p>
            <h2 className="mt-1 text-2xl font-bold">Video links</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={videoUrls.length >= 8}
            onClick={() => setVideoUrls((urls) => [...urls, ""])}
          >
            <Plus /> Add video
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {videoUrls.length === 0 ? <p className="text-sm text-ink-muted">No video links added.</p> : null}
          {videoUrls.map((url, index) => (
            <div key={index} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Video {index + 1}</span>
                <Input
                  className="mt-2"
                  type="url"
                  value={url}
                  onChange={(event) => setVideoUrls((urls) => urls.map((entry, position) => (position === index ? event.target.value : entry)))}
                  placeholder="https://…"
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove video ${index + 1}`}
                onClick={() => setVideoUrls((urls) => urls.filter((_, position) => position !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t-4 border-lime bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
          <div>
            <p className="eyebrow text-cobalt">Structured content</p>
            <h2 className="mt-1 text-2xl font-bold">Reorderable blocks</h2>
            <p className="mt-1 text-xs text-ink-muted">Each block is validated with gameRuleBlockSchema before it is saved as JSON.</p>
          </div>
          <div className="flex items-end gap-2">
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Block type</span>
              <select
                className="mt-1 h-10 border border-navy/20 bg-white px-3 text-sm"
                value={newBlockType}
                onChange={(event) => setNewBlockType(event.target.value as (typeof GAME_RULE_BLOCK_TYPES)[number])}
              >
                {GAME_RULE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <Button type="button" variant="lime" onClick={addBlock}><Plus /> Add block</Button>
          </div>
        </div>

        {!postId ? (
          <div className="mt-5">
            <Phase3Notice>Save this rule first to attach images or documents. Public visibility is limited to published game content.</Phase3Notice>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {blocks.length === 0 ? <p className="text-sm text-ink-muted">No blocks yet. The written sections above will still render on the public page.</p> : null}
          {blocks.map((draft, index) => (
            <div key={index} className="border border-navy/15 bg-chalk/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center bg-navy text-xs font-bold text-chalk">{index + 1}</span>
                  <select
                    aria-label={`Block ${index + 1} type`}
                    className="h-9 border border-navy/20 bg-white px-2 text-sm font-bold"
                    value={draft.blockType}
                    onChange={(event) => updateBlock(index, { blockType: event.target.value as (typeof GAME_RULE_BLOCK_TYPES)[number] })}
                  >
                    {GAME_RULE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Move block ${index + 1} down`} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove block ${index + 1}`} onClick={() => removeBlock(index)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {(draft.blockType === "heading" || draft.blockType === "paragraph" || draft.blockType === "quote" || draft.blockType === "rules_section") ? (
                  <EditorField label="Text" value={draft.text} onChange={(value) => updateBlock(index, { text: value })} rows={3} maxLength={6000} />
                ) : null}
                {draft.blockType === "rules_section" ? (
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Section title</span>
                    <Input className="mt-2" maxLength={120} value={draft.title} onChange={(event) => updateBlock(index, { title: event.target.value })} />
                  </label>
                ) : null}
                {draft.blockType === "quote" ? (
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Attribution</span>
                    <Input className="mt-2" maxLength={120} value={draft.attribution} onChange={(event) => updateBlock(index, { attribution: event.target.value })} />
                  </label>
                ) : null}
                {(draft.blockType === "bullet_list" || draft.blockType === "numbered_instructions" || draft.blockType === "rules_section") ? (
                  <EditorField
                    label="List items (one per line)"
                    value={draft.items}
                    onChange={(value) => updateBlock(index, { items: value })}
                    rows={5}
                    maxLength={6000}
                  />
                ) : null}
                {(draft.blockType === "image" || draft.blockType === "video_embed" || draft.blockType === "resource") ? (
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">URL{draft.blockType === "resource" ? " (optional if a document is attached)" : ""}</span>
                    <Input className="mt-2" type="url" value={draft.url} onChange={(event) => updateBlock(index, { url: event.target.value })} placeholder="https://…" />
                  </label>
                ) : null}
                {draft.blockType === "resource" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Link label</span>
                      <Input className="mt-2" maxLength={120} value={draft.label} onChange={(event) => updateBlock(index, { label: event.target.value })} />
                    </label>
                    <EditorField label="Description" value={draft.description} onChange={(value) => updateBlock(index, { description: value })} rows={2} maxLength={500} />
                  </>
                ) : null}
                {(draft.blockType === "image" || draft.blockType === "video_embed") ? (
                  <EditorField label="Caption" value={draft.caption} onChange={(value) => updateBlock(index, { caption: value })} rows={2} maxLength={300} />
                ) : null}

                {(draft.blockType === "image" || draft.blockType === "resource") ? (
                  postId ? (
                    <FileUploadControl
                      name={`block-file-${index}`}
                      parentType={draft.blockType === "resource" ? "game_rule_document" : "game_rule_image"}
                      parentId={postId}
                      visibility="public"
                      label={draft.blockType === "resource" ? "Document (public)" : "Image (public)"}
                      accept={draft.blockType === "resource" ? ".pdf,.doc,.docx,.txt" : ".jpg,.jpeg,.png,.webp"}
                    />
                  ) : null
                ) : null}

                {draft.blockType === "image_gallery" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Gallery images</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateBlock(index, { gallery: [...draft.gallery, { file_id: "", url: "", caption: "" }] })}
                      >
                        <Plus /> Add image
                      </Button>
                    </div>
                    {draft.gallery.map((entry, entryIndex) => (
                      <div key={entryIndex} className="border border-dashed border-navy/20 p-3">
                        <div className="flex items-end gap-2">
                          <label className="flex-1">
                            <span className="text-xs font-bold uppercase tracking-[0.14em] text-navy">Image URL (optional)</span>
                            <Input
                              className="mt-2"
                              type="url"
                              value={entry.url}
                              onChange={(event) => updateGalleryEntry(index, entryIndex, { url: event.target.value })}
                            />
                          </label>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove gallery image ${entryIndex + 1}`}
                            onClick={() => updateBlock(index, { gallery: draft.gallery.filter((_, position) => position !== entryIndex) })}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <Input
                          className="mt-3"
                          maxLength={200}
                          value={entry.caption}
                          placeholder="Caption"
                          onChange={(event) => updateGalleryEntry(index, entryIndex, { caption: event.target.value })}
                        />
                        {postId ? (
                          <div className="mt-3">
                            <FileUploadControl
                              name={`gallery-file-${index}-${entryIndex}`}
                              parentType="game_rule_image"
                              parentId={postId}
                              visibility="public"
                              label="Gallery image (public)"
                              accept=".jpg,.jpeg,.png,.webp"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-navy/10 bg-white p-6 shadow-sm">
        <p className="eyebrow text-cobalt">Live preview</p>
        <h2 className="mt-1 text-2xl font-bold">Public presentation</h2>
        <p className="mt-1 text-xs text-ink-muted">Uploaded files need a published rule before images can load here.</p>
        <div className="mt-5 border-t border-navy/10 pt-5">
          {previewBlocks.length ? <GameRuleBlocks blocks={previewBlocks} /> : <p className="text-sm text-ink-muted">Add a block to see a preview.</p>}
        </div>
      </section>

      <CmsActionNotice state={notice} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="lime" disabled={pending || title.trim().length < 3 || !slug.trim()}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
