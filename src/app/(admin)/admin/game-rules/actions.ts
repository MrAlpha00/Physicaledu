"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  gameRuleBlockSchema,
  gameRuleCategorySchema,
  gameRulePostSchema,
  type GameRuleCategoryInput,
  type GameRulePostInput,
} from "@/lib/validations/phase3";
import type { Json } from "@/types/database";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const result: { [key: string]: Json } = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const converted = toJson(entry);
      if (converted !== null) result[key] = converted;
    });
    return result;
  }
  return null;
}

function refreshRulePaths(postId?: string, slug?: string) {
  revalidatePath("/admin/game-rules");
  if (postId) revalidatePath(`/admin/game-rules/${postId}`);
  revalidatePath("/game-rules");
  if (slug) revalidatePath(`/game-rules/${slug}`);
  revalidatePath("/dashboard");
}

export async function saveGameRuleCategory(input: GameRuleCategoryInput): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = gameRuleCategorySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_game_rule_category", {
    p_category_id: data.id || null,
    p_data: toJson({
      name: data.name,
      slug: data.slug,
      description: data.description ?? "",
      sort_order: data.sortOrder,
      is_active: data.isActive,
    }),
  });
  if (error) return { status: "error", message: error.message || "The category could not be saved." };

  refreshRulePaths();
  return { status: "success", message: data.id ? "Category updated." : "Category created." };
}

export async function saveGameRulePost(
  input: GameRulePostInput,
): Promise<ActionState & { postId?: string }> {
  await requirePeAdmin();
  const parsed = gameRulePostSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  for (let index = 0; index < data.blocks.length; index += 1) {
    const block = gameRuleBlockSchema.safeParse(data.blocks[index]);
    if (!block.success) return { status: "error", message: `Block ${index + 1}: ${firstIssue(block.error)}` };
  }

  const postData = toJson({
    category_id: data.categoryId ?? "",
    title: data.title,
    slug: data.slug,
    introduction: data.introduction ?? "",
    history: data.history ?? "",
    about_game: data.aboutGame ?? "",
    how_to_play: data.howToPlay ?? "",
    rules_text: data.rulesText ?? "",
    equipment_required: data.equipmentRequired ?? "",
    players_count: data.playersCount ?? "",
    playing_area: data.playingArea ?? "",
    instructions: data.instructions ?? "",
    safety_instructions: data.safetyInstructions ?? "",
    video_urls: data.videoUrls,
    status: data.status,
    is_featured: data.isFeatured,
    is_pinned: data.isPinned,
  });

  const blocks = toJson(
    data.blocks.map((block) => ({
      block_type: block.blockType,
      content: block.content,
      sort_order: block.sortOrder,
    })),
  );

  const supabase = await createClient();
  const { data: saved, error } = await supabase.rpc("admin_save_game_rule_post", {
    p_post_id: data.id || null,
    p_data: postData,
    p_blocks: blocks,
  });
  if (error) return { status: "error", message: error.message || "The game rule could not be saved." };

  const postId = saved?.[0]?.id ?? data.id ?? "";
  refreshRulePaths(postId || undefined, data.slug);
  return {
    status: "success",
    message:
      data.status === "published"
        ? data.id ? "Game rule updated and published." : "Game rule created and published."
        : data.id ? "Game rule updated." : "Draft created. Publish it when the content is ready.",
    postId,
  };
}
