import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, ExternalLink, MapPin, ShieldCheck, Users } from "lucide-react";
import { GameRuleBlocks } from "@/components/phase3/cms/game-rule-blocks";
import { resolveGameRuleFileUrls } from "@/components/phase3/cms/game-rule-media";
import { safeExternalUrl, toEmbedUrl } from "@/components/phase3/cms/game-rule-block-content";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicGameRulePostBySlug } from "@/lib/data/phase3-cms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicGameRulePostBySlug(slug);
  if (!post) return { title: "Game rule not found" };
  return {
    title: post.title,
    description: post.introduction?.slice(0, 160) ?? `Read the published rules for ${post.title}.`,
  };
}

function RuleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-navy/10 pt-6">
      <h2 className="border-l-4 border-l-cobalt pl-3 font-barlow text-3xl uppercase tracking-tight text-navy">{title}</h2>
      <div className="space-y-3 text-[15px] leading-7 text-navy">{children}</div>
    </section>
  );
}

function Paragraphs({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <>
      {value.split(/\n{2,}/).map((part, index) => (
        <p key={index} className="whitespace-pre-wrap text-[15px] leading-7 text-navy">{part}</p>
      ))}
    </>
  );
}

export default async function PublicGameRuleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublicGameRulePostBySlug(slug);
  if (!post) notFound();

  const fileUrls = await resolveGameRuleFileUrls(post.blocks);
  const published = post.publishedAt && !Number.isNaN(Date.parse(post.publishedAt))
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker={post.categoryName ? `Game rules / ${post.categoryName}` : "Game rules / Department guide"}
        title={post.title}
        description={post.introduction ?? undefined}
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/game-rules"><ArrowLeft /> All rules</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {published ? <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">Published {published}</span> : null}
        {post.isPinned ? <Badge variant="cobalt">Pinned</Badge> : null}
        {post.isFeatured ? <Badge variant="lime">Featured</Badge> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
        <article className="space-y-8 border border-navy/10 bg-white p-6 shadow-sm md:p-10">
          {post.introduction ? (
            <p className="border-l-4 border-l-lime pl-5 font-barlow text-2xl leading-snug text-navy md:text-3xl">{post.introduction}</p>
          ) : null}

          <GameRuleBlocks blocks={post.blocks} fileUrls={fileUrls} />

          {post.history ? <RuleSection title="History"><Paragraphs value={post.history} /></RuleSection> : null}
          {post.aboutGame ? <RuleSection title="About the game"><Paragraphs value={post.aboutGame} /></RuleSection> : null}
          {post.howToPlay ? <RuleSection title="How to play"><Paragraphs value={post.howToPlay} /></RuleSection> : null}
          {post.rulesText ? <RuleSection title="Rules"><Paragraphs value={post.rulesText} /></RuleSection> : null}
          {post.equipmentRequired ? <RuleSection title="Equipment"><Paragraphs value={post.equipmentRequired} /></RuleSection> : null}
          {post.instructions ? <RuleSection title="Instructions"><Paragraphs value={post.instructions} /></RuleSection> : null}
          {post.safetyInstructions ? <RuleSection title="Safety"><Paragraphs value={post.safetyInstructions} /></RuleSection> : null}

          {post.videoUrls.length ? (
            <RuleSection title="Videos">
              <div className="space-y-5">
                {post.videoUrls.map((url, index) => {
                  const embed = toEmbedUrl(url);
                  const link = safeExternalUrl(url);
                  if (!link) return null;
                  return (
                    <div key={index} className="space-y-2">
                      {embed ? (
                        <iframe
                          src={embed}
                          title={`${post.title} video ${index + 1}`}
                          className="aspect-video w-full border border-navy/10"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      ) : (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-cobalt hover:underline">
                          Open video {index + 1} <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </RuleSection>
          ) : null}
        </article>

        <aside className="space-y-4">
          <div className="border-t-4 border-t-lime bg-white p-6 shadow-sm">
            <p className="eyebrow text-cobalt">At a glance</p>
            <h2 className="mt-1 text-xl font-bold">Quick facts</h2>
            <dl className="mt-5 space-y-4">
              {post.playersCount ? (
                <div className="flex gap-3">
                  <Users className="mt-0.5 size-4 shrink-0 text-cobalt" />
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Players</dt><dd className="mt-1 text-sm font-semibold text-navy">{post.playersCount}</dd></div>
                </div>
              ) : null}
              {post.playingArea ? (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-cobalt" />
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Playing area</dt><dd className="mt-1 text-sm font-semibold text-navy">{post.playingArea}</dd></div>
                </div>
              ) : null}
              {post.equipmentRequired ? (
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-cobalt" />
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Equipment</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-navy">{post.equipmentRequired}</dd></div>
                </div>
              ) : null}
              {post.safetyInstructions ? (
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-coral" />
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Safety</dt><dd className="mt-1 line-clamp-4 text-sm font-semibold text-navy">{post.safetyInstructions}</dd></div>
                </div>
              ) : null}
            </dl>
          </div>
          <Phase3Notice>
            Follow your teacher's instructions as well as these published rules. Report unsafe conditions to a PE staff member.
          </Phase3Notice>
        </aside>
      </div>
    </div>
  );
}
