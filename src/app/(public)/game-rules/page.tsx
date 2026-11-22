import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getGameRuleCategories, getPublicGameRulePosts } from "@/lib/data/phase3-cms";

export const metadata: Metadata = { title: "Game rules library" };
export const dynamic = "force-dynamic";

export default async function PublicGameRulesPage() {
  const [posts, categories, user] = await Promise.all([
    getPublicGameRulePosts(),
    getGameRuleCategories(),
    getCurrentUser(),
  ]);
  const activeCategories = categories.filter((category) => category.is_active);
  const categorised = activeCategories
    .map((category) => ({ category, posts: posts.filter((post) => post.categoryId === category.id) }))
    .filter((group) => group.posts.length > 0);
  const uncategorised = posts.filter((post) => !post.categoryId || !activeCategories.some((category) => category.id === post.categoryId));

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker={user ? "For students / PE department" : "Public / PE department"}
        title="Game rules"
        description="Clear, department-approved guides to how each game is played, scored and kept safe."
        actions={
          user ? (
            <Button asChild variant="lime"><Link href="/dashboard">My dashboard</Link></Button>
          ) : (
            <Button asChild variant="lime"><Link href="/login?next=/game-rules">Sign in</Link></Button>
          )
        }
      />

      <Phase3Notice>
        This library only shows published guides. Ask the PE office if a rule you need is missing.
      </Phase3Notice>

      {posts.length === 0 ? (
        <div className="border border-dashed border-navy/20 bg-white px-6 py-16 text-center">
          <BookOpenText className="mx-auto size-8 text-cobalt" />
          <h2 className="mt-4 font-barlow text-3xl text-navy">No guides published yet</h2>
          <p className="mt-2 text-sm text-ink-muted">The PE department is preparing the first set of game rules. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {[
            ...categorised.map((group) => ({ label: group.category.name, description: group.category.description, posts: group.posts })),
            ...(uncategorised.length ? [{ label: "More guides", description: null, posts: uncategorised }] : []),
          ].map((group) => (
            <section key={group.label} className="space-y-4">
              <div className="border-b-2 border-navy pb-2">
                <h2 className="font-barlow text-3xl uppercase tracking-tight text-navy">{group.label}</h2>
                {group.description ? <p className="mt-1 text-sm text-ink-muted">{group.description}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/game-rules/${post.slug}`}
                    className="group flex h-full flex-col border border-navy/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-lime hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {post.isPinned ? <Badge variant="cobalt">Pinned</Badge> : null}
                      {post.isFeatured ? <Badge variant="lime">Featured</Badge> : null}
                    </div>
                    <h3 className="mt-3 font-barlow text-2xl leading-tight text-navy group-hover:text-cobalt">{post.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
                      {post.introduction ?? "Open the guide for the full rules, equipment and safety notes."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy/10 pt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                      {post.playersCount ? <span>{post.playersCount}</span> : null}
                      {post.playingArea ? <span>{post.playingArea}</span> : null}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-cobalt">
                      Read guide <ArrowUpRight className="size-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
