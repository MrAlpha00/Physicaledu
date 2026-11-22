import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, FileCheck2, FilePenLine, Layers3 } from "lucide-react";
import { GameRuleCategoryManager } from "@/components/phase3/cms/game-rule-category-manager";
import { Phase3Header, Phase3Metric, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getGameRuleCategories, getAdminGameRulePosts } from "@/lib/data/phase3-cms";

export const metadata: Metadata = { title: "Game rules CMS" };
export const dynamic = "force-dynamic";

export default async function AdminGameRulesPage() {
  const [posts, categories] = await Promise.all([getAdminGameRulePosts(), getGameRuleCategories()]);
  const published = posts.filter((post) => post.status === "published").length;
  const drafts = posts.filter((post) => post.status === "draft").length;

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Content management"
        title="Game rules"
        description="Write, structure and publish the department's game guides. Drafts stay private until they are published."
        actions={
          <Button asChild variant="lime">
            <Link href="/admin/game-rules/new">New game rule</Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Phase3Metric label="Articles" value={posts.length} detail="All statuses in the CMS" icon={BookOpenText} />
        <Phase3Metric label="Published" value={published} detail="Visible on the public site" icon={FileCheck2} tone="lime" />
        <Phase3Metric label="Drafts" value={drafts} detail="Still being edited" icon={FilePenLine} tone="coral" />
        <Phase3Metric label="Categories" value={categories.length} detail="Used to group the library" icon={Layers3} tone="cobalt" />
      </section>

      <section className="space-y-4">
        <div className="border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Categories</h2>
          <p className="mt-1 text-xs text-ink-muted">Group the public library. Inactive categories can be kept for old articles.</p>
        </div>
        <GameRuleCategoryManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            sortOrder: category.sort_order,
            isActive: category.is_active,
          }))}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">All game rules</h2>
          <p className="text-xs text-ink-muted">{posts.length} article{posts.length === 1 ? "" : "s"}</p>
        </div>
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Blocks</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-10 text-center text-sm text-ink-muted">
                    No game rules yet. Create the first draft to start the library.
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <p className="text-sm font-bold">{post.title}</p>
                      <p className="mt-1 font-mono text-[11px] text-ink-muted">/{post.slug}</p>
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{post.categoryName ?? "Uncategorised"}</TableCell>
                    <TableCell>
                      <Phase3StatusBadge
                        label={post.status}
                        tone={post.status === "published" ? "good" : post.status === "draft" ? "warn" : "neutral"}
                      />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-ink-muted">{post.blocks.length}</TableCell>
                    <TableCell className="text-xs text-ink-muted">{post.updatedAt.slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-bold">
                        <Link href={`/admin/game-rules/${post.id}`} className="text-cobalt hover:underline">Edit</Link>
                        {post.status === "published" ? (
                          <Link href={`/game-rules/${post.slug}`} className="text-navy hover:underline">View</Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
