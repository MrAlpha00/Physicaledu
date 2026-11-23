"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  gameCatalogSchema,
  gameSettingsSchema,
  moderationActionSchema,
  ratingAdjustmentSchema,
  reviewSchema,
  restrictionSchema,
} from "@/lib/validations/phase5";
import type { Json } from "@/types/database";

export interface AdminActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

function fail(message: string, fieldErrors?: Record<string, string[]>): AdminActionState {
  return { ok: false, message, fieldErrors };
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function refreshGames() {
  revalidatePath("/admin/games");
  revalidatePath("/admin/games/moderation");
  revalidatePath("/admin/games/ratings");
  revalidatePath("/games");
}

export async function saveGameAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePeAdmin();
  const slug = String(formData.get("gameSlug") ?? "");
  const parsed = gameCatalogSchema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    instructions: formData.get("instructions"),
    category: formData.get("category"),
    accent: formData.get("accent"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isEnabled: formData.get("isEnabled") === "on",
    guestEnabled: formData.get("guestEnabled") === "on",
    competitiveEnabled: formData.get("competitiveEnabled") === "on",
    challengeEnabled: formData.get("challengeEnabled") === "on",
    practiceEnabled: formData.get("practiceEnabled") === "on",
    leaderboardVisible: formData.get("leaderboardVisible") === "on",
    maintenanceMessage: formData.get("maintenanceMessage") ?? "",
  });
  if (!parsed.success) return fail("Check the game details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_admin_save_game", {
    p_slug: slug,
    p_data: asJson({
      ...parsed.data,
      rules: formData.get("rules")
        ? String(formData.get("rules")).split("\n").map((line) => line.trim()).filter(Boolean)
        : [],
    }),
  });
  if (error) return fail(error.message);
  refreshGames();
  return { ok: true, message: "Game configuration saved." };
}

export async function saveSettingsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePeAdmin();
  const slug = String(formData.get("gameSlug") ?? "");
  const parsed = gameSettingsSchema.safeParse({
    startingRating: Number(formData.get("startingRating")),
    kFactor: Number(formData.get("kFactor")),
    defaultAttempts: Number(formData.get("defaultAttempts")),
    penaltyAttempts: Number(formData.get("penaltyAttempts")),
    queenValue: Number(formData.get("queenValue")),
    coinValue: Number(formData.get("coinValue")),
    suddenDeath: formData.get("suddenDeath") === "on",
    challengeExpiryMinutes: Number(formData.get("challengeExpiryMinutes")),
    challengeRateLimit: Number(formData.get("challengeRateLimit")),
    reconnectionGraceMinutes: Number(formData.get("reconnectionGraceMinutes")),
    seasonKey: formData.get("seasonKey"),
    seasonLabel: formData.get("seasonLabel"),
    defaultTimeControl: formData.get("defaultTimeControl"),
  });
  if (!parsed.success) return fail("Check the rating settings.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const payload: Record<string, unknown> = {
    ...parsed.data,
    chessTimeControls: String(formData.get("chessTimeControls") ?? "unlimited,5,10,15")
      .split(",").map((value) => value.trim()).filter(Boolean),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_admin_save_settings", { p_slug: slug, p_data: asJson(payload) });
  if (error) return fail(error.message);
  refreshGames();
  return { ok: true, message: "Rating and match settings saved." };
}

export async function adjustRatingAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePeAdmin();
  const parsed = ratingAdjustmentSchema.safeParse({
    userId: formData.get("userId"),
    gameSlug: formData.get("gameSlug"),
    rating: Number(formData.get("rating")),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return fail("Check the adjustment details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_admin_adjust_rating", {
    p_user_id: parsed.data.userId,
    p_game_slug: parsed.data.gameSlug,
    p_new_rating: parsed.data.rating,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(error.message);
  refreshGames();
  return { ok: true, message: "Rating adjusted and audited." };
}

export async function moderateNameAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePeAdmin();
  const parsed = moderationActionSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fail("Choose a valid moderation action.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_admin_moderate_name", {
    p_user_id: parsed.data.userId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return fail(error.message);
  refreshGames();
  return { ok: true, message: "Display name moderation updated." };
}

export async function reviewReportAction(formData: FormData): Promise<void> {
  await requirePeAdmin();
  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("phase5_admin_review_report", {
    p_report_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  refreshGames();
}

export async function reviewDisputeAction(formData: FormData): Promise<void> {
  await requirePeAdmin();
  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("phase5_admin_review_dispute", {
    p_dispute_id: parsed.data.id,
    p_status: parsed.data.status,
    p_resolution: parsed.data.note,
  });
  refreshGames();
}

export async function setRestrictionAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePeAdmin();
  const parsed = restrictionSchema.safeParse({
    userId: formData.get("userId"),
    gameSlug: formData.get("gameSlug") || null,
    type: formData.get("type"),
    reason: formData.get("reason"),
    expiresAt: formData.get("expiresAt") || null,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return fail("Check the restriction details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_admin_set_restriction", {
    p_user_id: parsed.data.userId,
    p_game_slug: parsed.data.gameSlug ?? "",
    p_type: parsed.data.type,
    p_reason: parsed.data.reason,
    p_expires_at: parsed.data.expiresAt ?? null,
    p_active: parsed.data.active,
  });
  if (error) return fail(error.message);
  refreshGames();
  return { ok: true, message: "Restriction applied." };
}
