/**
 * Realtime transport only. Channels are namespaced and RLS-protected in SQL;
 * nothing received here is ever treated as an authority for game state.
 */
import type { Json } from "@/types/database";
import type { GameSlug } from "./types";

export interface RealtimeMessage {
  type: "state" | "ready" | "presence" | "complete" | "challenge" | "rematch";
  matchId?: string;
  payload?: Record<string, Json>;
  sentAt: string;
}

export function matchChannelName(matchId: string): string {
  return `phase5:match:${matchId}`;
}

export function challengeChannelName(userId: string): string {
  return `phase5:challenges:${userId}`;
}

export function leaderboardChannelName(slug: GameSlug): string {
  return `phase5:leaderboard:${slug}`;
}

export type Unsubscribe = () => void;

/**
 * Opens a broadcast channel. Returns a cleanup function that must be called by
 * the consuming effect. Failures degrade to polling in the match room.
 */
export async function subscribeToChannel(
  channelName: string,
  onMessage: (message: RealtimeMessage) => void,
): Promise<Unsubscribe> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "phase5" }, ({ payload }) => {
    if (payload && typeof payload === "object" && "type" in payload) {
      onMessage(payload as unknown as RealtimeMessage);
    }
  });
  await channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function broadcastChannelMessage(channelName: string, message: Omit<RealtimeMessage, "sentAt">): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
  await channel.subscribe();
  await channel.send({ type: "broadcast", event: "phase5", payload: { ...message, sentAt: new Date().toISOString() } });
  void supabase.removeChannel(channel);
}
