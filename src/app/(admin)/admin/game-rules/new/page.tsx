import type { Metadata } from "next";
import Link from "next/link";
import { GameRulePostEditor } from "@/components/phase3/cms/game-rule-post-editor";
import { Phase3Header } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { getGameRuleCategories } from "@/lib/data/phase3-cms";

export const metadata: Metadata = { title: "New game rule" };
export const dynamic = "force-dynamic";

export default async function NewGameRulePage() {
  const categories = await getGameRuleCategories();
  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Content management"
        title="New game rule"
        description="Save a draft first, then add public images and structured blocks from the editor."
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/game-rules">Back to game rules</Link>
          </Button>
        }
      />
      <GameRulePostEditor
        initial={null}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </div>
  );
}
