import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameRulePostEditor, type GameRulePostInitialValue } from "@/components/phase3/cms/game-rule-post-editor";
import { blockToDraft } from "@/components/phase3/cms/game-rule-block-content";
import { Phase3Header, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { getGameRuleCategories, getAdminGameRulePosts } from "@/lib/data/phase3-cms";

export const metadata: Metadata = { title: "Edit game rule" };
export const dynamic = "force-dynamic";

export default async function EditGameRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [posts, categories] = await Promise.all([getAdminGameRulePosts(), getGameRuleCategories()]);
  const post = posts.find((item) => item.id === id);
  if (!post) notFound();

  const initial: GameRulePostInitialValue = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    categoryId: post.categoryId ?? "",
    status: post.status,
    introduction: post.introduction ?? "",
    history: post.history ?? "",
    aboutGame: post.aboutGame ?? "",
    howToPlay: post.howToPlay ?? "",
    rulesText: post.rulesText ?? "",
    equipmentRequired: post.equipmentRequired ?? "",
    playersCount: post.playersCount ?? "",
    playingArea: post.playingArea ?? "",
    instructions: post.instructions ?? "",
    safetyInstructions: post.safetyInstructions ?? "",
    videoUrls: post.videoUrls,
    isFeatured: post.isFeatured,
    isPinned: post.isPinned,
    blocks: post.blocks.map(blockToDraft),
  };

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Content management"
        title="Edit game rule"
        description="Changes to published articles appear on the public site immediately. Reorder blocks with the arrow controls."
        actions={
          <>
            <Phase3StatusBadge
              label={post.status}
              tone={post.status === "published" ? "good" : post.status === "draft" ? "warn" : "neutral"}
            />
            <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
              <Link href="/admin/game-rules">Back to game rules</Link>
            </Button>
          </>
        }
      />
      <GameRulePostEditor
        initial={initial}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </div>
  );
}
