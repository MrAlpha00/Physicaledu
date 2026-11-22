import type { QrType } from "@/types/database";

export interface QrTheme {
  key: string;
  background: string;
  foreground: string;
  accent: string;
  ink: string;
  kicker: string;
  instructions: string;
}

/**
 * Five distinct identities; four are used in Phase 2. The equipment theme is
 * reserved so Phase 3 can stay visually consistent.
 */
export const QR_THEMES: Record<string, QrTheme> = {
  entrance: {
    key: "entrance",
    background: "#101D2C",
    foreground: "#C8F169",
    accent: "#C8F169",
    ink: "#F4F2E9",
    kicker: "PE BLOCK · ENTRANCE",
    instructions: "Scan to sign the digital visitor register.",
  },
  playing: {
    key: "playing",
    background: "#F4F2E9",
    foreground: "#3564E9",
    accent: "#3564E9",
    ink: "#101D2C",
    kicker: "PE FACILITY · PLAYING ROOM",
    instructions: "Scan on entry and again when you leave.",
  },
  gym: {
    key: "gym",
    background: "#101D2C",
    foreground: "#F27A5C",
    accent: "#F27A5C",
    ink: "#F4F2E9",
    kicker: "PE FACILITY · GYM",
    instructions: "Scan on entry and again when you finish.",
  },
  mental: {
    key: "mental",
    background: "#F4F2E9",
    foreground: "#5B4BD6",
    accent: "#5B4BD6",
    ink: "#101D2C",
    kicker: "PE FACILITY · MENTAL GAMES",
    instructions: "Scan on entry and again when you leave.",
  },
  equipment: {
    key: "equipment",
    background: "#FFF7E4",
    foreground: "#A76B00",
    accent: "#E8A400",
    ink: "#101D2C",
    kicker: "PE EQUIPMENT",
    instructions: "Reserved for equipment issue and return.",
  },
};

export const QR_TYPE_LABELS: Record<QrType, string> = {
  visitor_entrance: "PE Block Entrance",
  playing_room: "Playing Room",
  gym_room: "Gym Room",
  mental_games_room: "Mental Games Room",
  equipment: "Equipment (Phase 3)",
};

/** Build the absolute destination encoded in a printable QR code. */
export function buildQrDestination(
  siteUrl: string,
  destinationPath: string,
  token: string,
): string {
  const origin = siteUrl.replace(/\/$/, "");
  const path = destinationPath.replace(/\/$/, "");
  return `${origin}${path}/${encodeURIComponent(token)}`;
}

export interface QrScanTarget {
  kind: "visitor" | "room";
  token: string;
  destination: string;
}

/** Reject arbitrary URLs scanned from a QR code. */
export function parseQrScanValue(
  value: string,
  currentOrigin: string,
): QrScanTarget | null {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.origin !== new URL(currentOrigin).origin) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const visitor = url.pathname.match(/^\/visit\/([A-Za-z0-9_-]{16,200})$/);
  if (visitor) {
    return { kind: "visitor", token: visitor[1], destination: `/visit/${visitor[1]}` };
  }
  const room = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{16,200})$/);
  if (room) {
    return { kind: "room", token: room[1], destination: `/room/${room[1]}` };
  }
  return null;
}
