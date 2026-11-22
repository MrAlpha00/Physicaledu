import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { GameRuleBlockView, GameRulePostView } from "@/types/domain";

function contentRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function mapPosts(
  posts: Array<Record<string, unknown>>,
  includeDrafts: boolean,
): Promise<GameRulePostView[]> {
  if (posts.length === 0) return [];
  const supabase = await createClient();
  const postIds = posts.map((post) => String(post.id));
  const [categoriesResult, blocksResult] = await Promise.all([
    supabase.from("game_rule_categories").select("id, name"),
    supabase.from("game_rule_blocks").select("id, post_id, block_type, content, sort_order").in("post_id", postIds),
  ]);
  const categoryNames = new Map((categoriesResult.data ?? []).map((row) => [row.id, row.name]));
  const blocksByPost = new Map<string, GameRuleBlockView[]>();
  (blocksResult.data ?? []).forEach((row) => {
    const list = blocksByPost.get(row.post_id) ?? [];
    list.push({
      id: row.id,
      blockType: row.block_type,
      content: contentRecord(row.content),
      sortOrder: row.sort_order,
    });
    blocksByPost.set(row.post_id, list);
  });

  return posts.map((post) => ({
    id: String(post.id),
    categoryId: (post.category_id as string | null) ?? null,
    categoryName: post.category_id ? categoryNames.get(String(post.category_id)) ?? null : null,
    title: String(post.title),
    slug: String(post.slug),
    introduction: (post.introduction as string | null) ?? null,
    history: (post.history as string | null) ?? null,
    aboutGame: (post.about_game as string | null) ?? null,
    howToPlay: (post.how_to_play as string | null) ?? null,
    rulesText: (post.rules_text as string | null) ?? null,
    equipmentRequired: (post.equipment_required as string | null) ?? null,
    playersCount: (post.players_count as string | null) ?? null,
    playingArea: (post.playing_area as string | null) ?? null,
    instructions: (post.instructions as string | null) ?? null,
    safetyInstructions: (post.safety_instructions as string | null) ?? null,
    videoUrls: Array.isArray(post.video_urls) ? (post.video_urls as string[]) : [],
    status: post.status as GameRulePostView["status"],
    publishedAt: (post.published_at as string | null) ?? null,
    isFeatured: Boolean(post.is_featured),
    isPinned: Boolean(post.is_pinned),
    updatedAt: String(post.updated_at),
    blocks: (blocksByPost.get(String(post.id)) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((post) => includeDrafts || post.status === "published");
}

export const getAdminGameRulePosts = cache(async (): Promise<GameRulePostView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_rule_posts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);
  return mapPosts((data ?? []) as Array<Record<string, unknown>>, true);
});

export const getPublicGameRulePosts = cache(async (): Promise<GameRulePostView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_rule_posts")
    .select("*")
    .eq("status", "published")
    .order("is_pinned", { ascending: false })
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(200);
  return mapPosts((data ?? []) as Array<Record<string, unknown>>, false);
});

export const getPublicGameRulePostBySlug = cache(async (slug: string): Promise<GameRulePostView | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_rule_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const [post] = await mapPosts([data as unknown as Record<string, unknown>], false);
  return post ?? null;
});

export const getGameRuleCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_rule_categories")
    .select("id, name, slug, description, sort_order, is_active")
    .order("sort_order")
    .order("name");
  return data ?? [];
});
