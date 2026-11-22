import Link from "next/link";
import { ExternalLink, ImageOff, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameRuleBlockView } from "@/types/domain";
import { safeExternalUrl, toEmbedUrl } from "./game-rule-block-content";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function BlockImage({
  fileId,
  url,
  caption,
  fileUrls,
}: {
  fileId: string;
  url: string;
  caption: string;
  fileUrls: Record<string, string>;
}) {
  const src = (fileId ? fileUrls[fileId] : null) ?? safeExternalUrl(url);
  if (!src) {
    return (
      <p className="flex items-center gap-2 border border-dashed border-navy/20 bg-chalk/40 px-4 py-6 text-sm text-ink-muted">
        <ImageOff className="size-4" /> {caption || "Image will appear here once it is uploaded and published."}
      </p>
    );
  }
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URLs are not covered by next/image remote patterns */}
      <img src={src} alt={caption || "Game rule illustration"} className="w-full border border-navy/10 object-cover" loading="lazy" />
      {caption ? <figcaption className="text-xs italic text-ink-muted">{caption}</figcaption> : null}
    </figure>
  );
}

function BlockList({ items, ordered }: { items: string[]; ordered: boolean }) {
  if (items.length === 0) return null;
  const className = cn(
    "space-y-2 pl-5 text-sm leading-relaxed text-navy",
    ordered ? "list-decimal marker:font-barlow marker:text-lg marker:font-bold marker:text-cobalt" : "list-disc marker:text-lime",
  );
  return ordered ? (
    <ol className={className}>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol>
  ) : (
    <ul className={className}>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
  );
}

function renderBlock(block: GameRuleBlockView, fileUrls: Record<string, string>, index: number) {
  const content = block.content ?? {};
  const key = block.id || `block-${index}`;
  switch (block.blockType) {
    case "heading":
      return asText(content.text) ? (
        <h2 key={key} className="border-l-4 border-l-lime pl-4 font-barlow text-3xl leading-tight tracking-tight text-navy">
          {asText(content.text)}
        </h2>
      ) : null;
    case "paragraph":
      return asText(content.text) ? (
        <p key={key} className="whitespace-pre-wrap text-[15px] leading-7 text-navy">{asText(content.text)}</p>
      ) : null;
    case "image":
      return (
        <BlockImage
          key={key}
          fileId={asText(content.file_id)}
          url={asText(content.url)}
          caption={asText(content.caption)}
          fileUrls={fileUrls}
        />
      );
    case "image_gallery": {
      const images = Array.isArray(content.images)
        ? content.images.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        : [];
      if (images.length === 0) return null;
      return (
        <div key={key} className="grid gap-4 sm:grid-cols-2">
          {images.map((image, position) => (
            <BlockImage
              key={`${key}-${position}`}
              fileId={asText(image.file_id)}
              url={asText(image.url)}
              caption={asText(image.caption)}
              fileUrls={fileUrls}
            />
          ))}
        </div>
      );
    }
    case "bullet_list":
      return <BlockList key={key} items={asList(content.items)} ordered={false} />;
    case "numbered_instructions":
      return <BlockList key={key} items={asList(content.items)} ordered />;
    case "rules_section": {
      const items = asList(content.items);
      if (!asText(content.title) && items.length === 0) return null;
      return (
        <section key={key} className="border-l-4 border-l-cobalt bg-cobalt/[0.04] p-5">
          {asText(content.title) ? <h3 className="font-barlow text-2xl text-navy">{asText(content.title)}</h3> : null}
          {items.length ? <div className="mt-3"><BlockList items={items} ordered={false} /></div> : null}
        </section>
      );
    }
    case "quote":
      return asText(content.text) ? (
        <blockquote key={key} className="border-y-2 border-navy/15 py-5 text-center">
          <p className="font-barlow text-2xl italic leading-snug text-navy">“{asText(content.text)}”</p>
          {asText(content.attribution) ? (
            <cite className="mt-2 block text-xs font-bold uppercase tracking-[0.16em] text-ink-muted not-italic">
              {asText(content.attribution)}
            </cite>
          ) : null}
        </blockquote>
      ) : null;
    case "video_embed": {
      const embed = toEmbedUrl(content.url);
      const link = safeExternalUrl(content.url);
      if (!embed && !link) return null;
      return (
        <figure key={key} className="space-y-3">
          {embed ? (
            <iframe
              src={embed}
              title={asText(content.caption) || "Game rules video"}
              className="aspect-video w-full border border-navy/10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="flex items-center gap-3 border border-navy/10 bg-chalk/40 px-4 py-5 text-sm">
              <PlayCircle className="size-5 text-cobalt" />
              <a href={link ?? "#"} target="_blank" rel="noopener noreferrer" className="font-bold text-cobalt hover:underline">
                Watch the video {asText(content.caption) ? `— ${asText(content.caption)}` : ""}
              </a>
            </div>
          )}
          {!embed && link ? (
            <figcaption className="text-xs text-ink-muted">Video hosted externally. Opens in a new tab.</figcaption>
          ) : null}
        </figure>
      );
    }
    case "resource": {
      const link = safeExternalUrl(content.url) ?? (asText(content.file_id) ? fileUrls[asText(content.file_id)] : null);
      if (!link) return null;
      const label = asText(content.label) || "Download resource";
      return (
        <div key={key} className="border border-navy/15 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cobalt">Resource</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-navy">{label}</p>
              {asText(content.description) ? <p className="mt-1 text-xs text-ink-muted">{asText(content.description)}</p> : null}
            </div>
            {link.startsWith("/") ? (
              <Link href={link} className="inline-flex items-center gap-2 text-sm font-bold text-cobalt hover:underline">
                Open <ExternalLink className="size-3" />
              </Link>
            ) : (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-cobalt hover:underline">
                Open <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

export function GameRuleBlocks({
  blocks,
  fileUrls = {},
}: {
  blocks: GameRuleBlockView[];
  fileUrls?: Record<string, string>;
}) {
  if (blocks.length === 0) return null;
  return <div className="space-y-7">{blocks.map((block, index) => renderBlock(block, fileUrls, index))}</div>;
}
