import { createClient } from "@/lib/supabase/server";
import { createPresignedDownload } from "@/lib/storage/r2-service";
import type { GameRuleBlockView } from "@/types/domain";
import { fileIdsFromBlocks } from "./game-rule-block-content";

/**
 * Server-only helper for the public game-rule pages. It resolves only files
 * whose RLS policy allows public access: confirmed, public-visibility files
 * belonging to a published game rule. Signed links are short lived, so callers
 * must render dynamically rather than caching markup.
 */
export async function resolveGameRuleFileUrls(blocks: GameRuleBlockView[]): Promise<Record<string, string>> {
  const ids = [...new Set(fileIdsFromBlocks(blocks))];
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("phase3_files")
    .select("id, object_key, original_filename")
    .in("id", ids)
    .in("parent_type", ["game_rule_image", "game_rule_document"])
    .eq("visibility", "public")
    .eq("upload_status", "confirmed");

  const entries = await Promise.all(
    (data ?? []).map(async (file) => {
      try {
        const signed = await createPresignedDownload(file.object_key, file.original_filename);
        return [file.id, signed.url] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, string] => entry !== null),
  );
}
