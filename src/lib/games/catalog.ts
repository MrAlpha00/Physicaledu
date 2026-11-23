/** Phase 5 — single source of truth for the six official VARSITY games. */
import type { GameConfig, GameSlug } from "./types";
import type { Json } from "@/types/database";

export interface GameDefinition {
  slug: GameSlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: string;
  players: string;
  accent: string;
  accentSoft: string;
  icon: string;
  rules: string[];
  controls: string[];
  matchFormat: string;
  defaultConfig: GameConfig;
  guestModes: string[];
  practiceSupported: boolean;
  chessTimeControls?: readonly string[];
}

const config = (value: Record<string, Json>): GameConfig => value;

export const GAME_DEFINITIONS: Record<GameSlug, GameDefinition> = {
  chess: {
    slug: "chess",
    name: "Chess",
    shortName: "Chess",
    tagline: "The classic battle of strategy.",
    description:
      "A full game of standard chess with legal move generation, check, checkmate and every draw rule supported by the engine. Play locally, practise, or take on another student in a rated match.",
    category: "Strategy",
    players: "2 players",
    accent: "#3564E9",
    accentSoft: "rgba(53, 100, 233, 0.12)",
    icon: "crown",
    rules: [
      "White moves first; players alternate one legal move at a time.",
      "Checkmate ends the game immediately. Stalemate, insufficient material, fifty moves and threefold repetition are draws.",
      "Pawns promote, castling and en passant are supported.",
      "Resignation or flag fall is recorded as a loss for that player.",
    ],
    controls: [
      "Tap or click a piece to see its legal destinations.",
      "Tap a highlighted square to move. Promotion offers a choice.",
      "Use Resign when you concede the game.",
    ],
    matchFormat: "Standard 1v1. Unlimited, 5, 10 or 15 minute clocks chosen by the challenger.",
    defaultConfig: config({ timeControl: "10" }),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
    chessTimeControls: ["unlimited", "5", "10", "15"],
  },
  carrom: {
    slug: "carrom",
    name: "Carrom",
    shortName: "Carrom",
    tagline: "Strike, pocket, repeat.",
    description:
      "A top-down carrom board with a deterministic fixed-timestep simulation. Aim the striker, set power and let physics decide which coins drop into the pockets.",
    category: "Tabletop",
    players: "2 players",
    accent: "#F27A5C",
    accentSoft: "rgba(242, 122, 92, 0.12)",
    icon: "disc",
    rules: [
      "Nine coins and one queen are arranged in the centre. Pocket a coin to keep your turn.",
      "A queen is worth 3 points but must be covered by pocketing a coin in the same shot, or it is returned.",
      "Pocketing the striker, or hitting nothing, is a foul: the turn passes and pocketed coins are returned.",
      "The player with the higher score when no coins remain wins.",
    ],
    controls: [
      "Drag the striker inside your half of the board to place it.",
      "Drag from the striker to aim, or use the aim and power sliders.",
      "Release Shoot to run the authoritative simulation.",
    ],
    matchFormat: "Standard 1v1 with alternating shots until all coins are cleared.",
    defaultConfig: config({ queenValue: 3, coinValue: 1, targetScore: 12 }),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
  },
  "tic-tac-toe": {
    slug: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    shortName: "Tic-Tac-Toe",
    tagline: "Three in a row takes skill.",
    description:
      "A crisp, responsive three-in-a-row board. X and O alternate, every move is validated, and the server decides wins and draws.",
    category: "Classic",
    players: "2 players",
    accent: "#C8F169",
    accentSoft: "rgba(200, 241, 105, 0.16)",
    icon: "grid",
    rules: [
      "Players alternate placing X and O in an empty square.",
      "Three matching marks in a row, column or diagonal wins.",
      "If all nine squares are filled without a win, the match is a draw.",
    ],
    controls: ["Tap any empty square to place your mark.", "Your active mark and turn are highlighted above the board."],
    matchFormat: "Best of one. X always moves first.",
    defaultConfig: config({}),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
  },
  "connect-four": {
    slug: "connect-four",
    name: "Connect Four",
    shortName: "Connect Four",
    tagline: "Drop in. Line up. Win.",
    description:
      "Drop red and yellow discs into a seven-column grid. The first player to connect four horizontally, vertically or diagonally wins.",
    category: "Strategy",
    players: "2 players",
    accent: "#3564E9",
    accentSoft: "rgba(53, 100, 233, 0.12)",
    icon: "columns",
    rules: [
      "Red moves first. Discs fall to the lowest available row in the chosen column.",
      "Four in a row in any direction wins the match.",
      "If the board fills without a connection, the match is a draw.",
    ],
    controls: ["Tap a column header or the column itself to drop a disc.", "Hover on desktop to preview the landing row."],
    matchFormat: "Best of one. Red always moves first.",
    defaultConfig: config({}),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
  },
  "penalty-shootout": {
    slug: "penalty-shootout",
    name: "Penalty Shootout",
    shortName: "Penalty",
    tagline: "Nerves of steel from twelve yards.",
    description:
      "A custom football penalty competition. Shooter and keeper choose simultaneously, decisions stay hidden until both are in, and the server resolves every attempt.",
    category: "Sport simulation",
    players: "2 players",
    accent: "#C8F169",
    accentSoft: "rgba(200, 241, 105, 0.16)",
    icon: "goal",
    rules: [
      "Each player takes five penalties, alternating roles. The score decides the winner.",
      "Attacker picks direction, height and power; the keeper picks a dive. Matching guesses save the shot.",
      "If tied after five each, sudden-death rounds are played until one side leads.",
    ],
    controls: [
      "As shooter, set direction, height and power, then confirm your shot.",
      "As keeper, choose a dive direction and height before revealing.",
      "Both choices are concealed until the server resolves the attempt.",
    ],
    matchFormat: "Five attempts each, then sudden death if level.",
    defaultConfig: config({ attempts: 5, suddenDeath: true }),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
  },
  basketball: {
    slug: "basketball",
    name: "Basketball Free-Throw",
    shortName: "Basketball",
    tagline: "Ten shots. One champion.",
    description:
      "An original free-throw challenge. Set your angle, power and release timing, watch the trajectory, and let the server calculate the result of every shot.",
    category: "Sport simulation",
    players: "2 players",
    accent: "#F27A5C",
    accentSoft: "rgba(242, 122, 92, 0.12)",
    icon: "hoop",
    rules: [
      "Players alternate shots. Each player takes ten attempts by default.",
      "Angle, power and release timing determine whether the shot drops.",
      "Highest score wins; a tie is resolved with sudden-death attempts.",
    ],
    controls: ["Set angle, power and release timing with the sliders.", "Release to fire and watch the animated trajectory.", "The server records the made or missed shot."],
    matchFormat: "Ten attempts each by default; admin-configurable, then sudden death.",
    defaultConfig: config({ attempts: 10, suddenDeath: true }),
    guestModes: ["Local two-player", "Practice"],
    practiceSupported: true,
  },
};

export const GAME_LIST: GameDefinition[] = GAME_SLUGS.map((slug) => GAME_DEFINITIONS[slug]);

export function isGameSlug(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}

export function gameConfigFor(slug: GameSlug, overrides?: Record<string, Json> | null): GameConfig {
  return { ...GAME_DEFINITIONS[slug].defaultConfig, ...(overrides ?? {}) };
}

export function configNumber(config: GameConfig, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function configString(config: GameConfig, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === "string" ? value : fallback;
}
