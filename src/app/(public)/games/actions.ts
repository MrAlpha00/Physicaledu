"use server";

import { guestSetupSchema } from "@/lib/validations/phase5";
import { gameConfigFor, isGameSlug } from "@/lib/games/catalog";
import type { GameSlug, GameConfig } from "@/lib/games/types";

const GUEST_PREFIXES = [
  "Rally", "Cobalt", "Chalk", "Sprint", "Navy", "Lime", "Pivot", "Ace",
  "Dunk", "Striker", "Rook", "Keeper", "Flick", "Volt", "Echo", "Nova",
];
const GUEST_SUFFIXES = ["Fox", "Tiger", "Comet", "Eagle", "Wave", "Star", "Arrow", "Panther"];

/** Guest play never writes to the database; the action only validates intent. */
export async function prepareGuestMatchAction(raw: unknown): Promise<{
  ok: boolean;
  message?: string;
  names?: [string, string];
  config?: GameConfig;
}> {
  const parsed = guestSetupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid guest setup." };
  }
  const config = gameConfigFor(parsed.data.gameSlug, parsed.data.config);
  return {
    ok: true,
    names: [parsed.data.playerOne, parsed.data.playerTwo],
    config,
  };
}

export async function randomGuestNameAction(exclude?: string): Promise<string> {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
  const random = () => `${pick(GUEST_PREFIXES)} ${pick(GUEST_SUFFIXES)}`;
  let name = random();
  let attempts = 0;
  while (name.toLowerCase() === (exclude ?? "").toLowerCase() && attempts < 8) {
    name = random();
    attempts += 1;
  }
  return name;
}

export async function validateGameSlugAction(slug: string): Promise<{ ok: boolean; slug?: GameSlug }> {
  return isGameSlug(slug) ? { ok: true, slug } : { ok: false };
}
