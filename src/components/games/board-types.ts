import type { Json } from "@/types/database";
import type { PlayerIndex } from "@/lib/games/types";

export interface BoardProps<S = unknown> {
  state: S;
  names: [string, string];
  active: PlayerIndex | null;
  onAction: (type: string, payload: Record<string, Json>) => void;
  disabled?: boolean;
  lastMessage?: string;
  /** For ranked play, the local user's player index. Undefined in local pass-and-play. */
  viewer?: PlayerIndex | null;
}
