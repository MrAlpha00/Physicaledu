/** Small deterministic helpers shared by the pure game engines. */
import type { Json } from "@/types/database";
import type { BaseState, GameAction, PlayerIndex } from "./types";

export function num(payload: Record<string, Json>, key: string, fallback = 0): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function str(payload: Record<string, Json>, key: string, fallback = ""): string {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

export function booleanValue(payload: Record<string, Json>, key: string, fallback = false): boolean {
  const value = payload[key];
  return typeof value === "boolean" ? value : fallback;
}

export function opponent(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

export function other(value: "w" | "b"): "w" | "b" {
  return value === "w" ? "b" : "w";
}

/** Deterministic 32-bit hash used for controlled shot variance. */
export function hashInt(...values: Array<number | string>): number {
  let hash = 2166136261;
  for (const value of values) {
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 124;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable pseudo-random value in [0, 1) derived only from explicit inputs. */
export function seededUnit(...values: Array<number | string>): number {
  return hashInt(...values) / 4294967296;
}

export function advance<S extends BaseState>(state: S, patch: Partial<S> = {}): S {
  return { ...state, ...patch, version: state.version + 1, seq: state.seq + 1 };
}
