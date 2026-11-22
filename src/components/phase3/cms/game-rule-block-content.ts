import { gameRuleBlockSchema, type GameRuleBlockInput } from "@/lib/validations/phase3";
import type { GameRuleBlockType } from "@/types/database";
import type { GameRuleBlockView } from "@/types/domain";

/**
 * Shared block shapes for the game-rule editor and the public renderer.
 * Content is stored as JSONB and always validated with gameRuleBlockSchema.
 */

export const GAME_RULE_BLOCK_TYPES: GameRuleBlockType[] = [
  "heading", "paragraph", "image", "image_gallery", "bullet_list",
  "numbered_instructions", "rules_section", "quote", "video_embed", "resource",
];

export const BLOCK_TYPE_LABELS: Record<GameRuleBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  image_gallery: "Image gallery",
  bullet_list: "Bullet list",
  numbered_instructions: "Numbered instructions",
  rules_section: "Rules section",
  quote: "Quote",
  video_embed: "Video embed",
  resource: "Resource / document",
};

export interface GalleryEntryDraft {
  file_id: string;
  url: string;
  caption: string;
}

export interface BlockDraft {
  blockType: GameRuleBlockType;
  sortOrder: number;
  text: string;
  items: string;
  title: string;
  caption: string;
  attribution: string;
  url: string;
  fileId: string;
  label: string;
  description: string;
  gallery: GalleryEntryDraft[];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function asGallery(value: unknown): GalleryEntryDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      file_id: asText(item.file_id),
      url: asText(item.url),
      caption: asText(item.caption),
    }));
}

export function createBlockDraft(blockType: GameRuleBlockType, sortOrder: number): BlockDraft {
  return {
    blockType,
    sortOrder,
    text: "",
    items: "",
    title: "",
    caption: "",
    attribution: "",
    url: "",
    fileId: "",
    label: "",
    description: "",
    gallery: [],
  };
}

export function blockToDraft(block: GameRuleBlockView): BlockDraft {
  const content = block.content ?? {};
  return {
    blockType: block.blockType,
    sortOrder: block.sortOrder,
    text: asText(content.text),
    items: asList(content.items).join("\n"),
    title: asText(content.title),
    caption: asText(content.caption),
    attribution: asText(content.attribution),
    url: asText(content.url),
    fileId: asText(content.file_id),
    label: asText(content.label),
    description: asText(content.description),
    gallery: asGallery(content.images),
  };
}

export function draftToBlock(draft: BlockDraft): GameRuleBlockInput {
  const items = draft.items.split("\n").map((item) => item.trim()).filter(Boolean);
  let content: Record<string, unknown> = {};

  switch (draft.blockType) {
    case "heading":
      content = { text: draft.text };
      break;
    case "paragraph":
      content = { text: draft.text };
      break;
    case "image":
      content = { file_id: draft.fileId, url: draft.url, caption: draft.caption };
      break;
    case "image_gallery":
      content = { images: draft.gallery };
      break;
    case "bullet_list":
      content = { items };
      break;
    case "numbered_instructions":
      content = { items };
      break;
    case "rules_section":
      content = { title: draft.title, items };
      break;
    case "quote":
      content = { text: draft.text, attribution: draft.attribution };
      break;
    case "video_embed":
      content = { url: draft.url, caption: draft.caption };
      break;
    case "resource":
      content = {
        label: draft.label,
        url: draft.url,
        file_id: draft.fileId,
        description: draft.description,
      };
      break;
  }

  return { blockType: draft.blockType, content, sortOrder: draft.sortOrder };
}

export function validateBlockDraft(draft: BlockDraft): string | null {
  const parsed = gameRuleBlockSchema.safeParse(draftToBlock(draft));
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "This block is incomplete.";
}

export function fileIdsFromBlocks(blocks: GameRuleBlockView[]): string[] {
  const ids = new Set<string>();
  blocks.forEach((block) => {
    const fileId = block.content?.file_id;
    if (typeof fileId === "string" && fileId) ids.add(fileId);
    const images = block.content?.images;
    if (Array.isArray(images)) {
      images.forEach((image) => {
        if (image && typeof image === "object" && !Array.isArray(image)) {
          const entry = image as Record<string, unknown>;
          if (typeof entry.file_id === "string" && entry.file_id) ids.add(entry.file_id);
        }
      });
    }
  });
  return [...ids];
}

/** Only http(s) links are ever emitted into markup. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Convert common YouTube/Vimeo links into embeddable URLs; otherwise null. */
export function toEmbedUrl(value: unknown): string | null {
  const url = safeExternalUrl(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
      const short = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})$/);
      if (short) return `https://www.youtube-nocookie.com/embed/${short[1]}`;
      return null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
      return null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
      return null;
    }
    if (host === "www.youtube-nocookie.com") return url;
    return null;
  } catch {
    return null;
  }
}
