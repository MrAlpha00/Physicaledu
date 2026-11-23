/**
 * Generates the original VARSITY PWA artwork from vector source.
 * Run with: node scripts/generate-pwa-assets.mjs
 * Requires the existing `sharp` dependency; no external image service is used.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");
await mkdir(outDir, { recursive: true });

const navy = "#101D2C";
const navyDeep = "#0A131F";
const chalk = "#F4F2E9";
const lime = "#C8F169";
const cobalt = "#3564E9";
const coral = "#F27A5C";

function iconSvg(size, { maskable = false } = {}) {
  const inset = maskable ? size * 0.18 : 0;
  const inner = size - inset * 2;
  const stripe = inner * 0.14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${navy}"/>
      <stop offset="1" stop-color="${navyDeep}"/>
    </linearGradient>
    <clipPath id="frame"><rect x="${inset}" y="${inset}" width="${inner}" height="${inner}" rx="${maskable ? inner * 0.12 : inner * 0.2}"/></clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g clip-path="url(#frame)">
    <rect x="${inset + inner * 0.62}" y="${inset}" width="${stripe}" height="${inner}" fill="${lime}" transform="rotate(18 ${inset + inner * 0.62} ${inset})"/>
    <rect x="${inset}" y="${inset + inner * 0.78}" width="${inner}" height="${inner * 0.06}" fill="${cobalt}" opacity="0.85"/>
    <path d="M ${inset + inner * 0.2} ${inset + inner * 0.26}
             L ${inset + inner * 0.32} ${inset + inner * 0.26}
             L ${inset + inner * 0.5} ${inset + inner * 0.68}
             L ${inset + inner * 0.68} ${inset + inner * 0.26}
             L ${inset + inner * 0.8} ${inset + inner * 0.26}
             L ${inset + inner * 0.55} ${inset + inner * 0.8}
             Z" fill="${chalk}"/>
    <circle cx="${inset + inner * 0.5}" cy="${inset + inner * 0.29}" r="${inner * 0.035}" fill="${coral}"/>
    <text x="${inset + inner * 0.5}" y="${inset + inner * 0.94}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="800"
      font-size="${inner * 0.115}" letter-spacing="${inner * 0.02}" fill="${lime}">VARSITY</text>
  </g>
</svg>`;
}

function screenshotSvg(width, height, narrow) {
  const header = narrow ? 86 : 74;
  const cards = narrow
    ? [
        [24, 132, width - 48, 150, lime],
        [24, 300, width - 48, 120, cobalt],
        [24, 438, width - 48, 120, coral],
      ]
    : [
        [48, 120, 360, 210, lime],
        [440, 120, 360, 210, cobalt],
        [832, 120, 360, 210, coral],
      ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${chalk}"/>
  <rect width="${width}" height="${header}" fill="${navy}"/>
  <text x="${narrow ? 24 : 48}" y="${header / 2 + 10}" font-family="Arial, Helvetica, sans-serif"
    font-size="${narrow ? 34 : 30}" font-weight="800" letter-spacing="4" fill="${lime}">VARSITY</text>
  <circle cx="${width - (narrow ? 40 : 64)}" cy="${header / 2}" r="${narrow ? 12 : 10}" fill="${coral}"/>
  <text x="${narrow ? 24 : 48}" y="${narrow ? 120 : 82}" font-family="Arial, Helvetica, sans-serif"
    font-size="${narrow ? 26 : 18}" font-weight="700" fill="${navy}">College PE Management Platform</text>
  ${cards
    .map(
      ([x, y, w, h, accent]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#FFFFFF"/>
    <rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${accent}"/>
    <rect x="${x + 26}" y="${y + 26}" width="${w * 0.58}" height="14" rx="7" fill="${navy}" opacity="0.75"/>
    <rect x="${x + 26}" y="${y + 58}" width="${w * 0.8}" height="10" rx="5" fill="${navy}" opacity="0.22"/>
    <rect x="${x + 26}" y="${y + 80}" width="${w * 0.64}" height="10" rx="5" fill="${navy}" opacity="0.16"/>
    <rect x="${x + 26}" y="${y + h - 44}" width="90" height="26" rx="6" fill="${accent}"/>`,
    )
    .join("")}
  <text x="${narrow ? 24 : 48}" y="${height - 30}" font-family="Arial, Helvetica, sans-serif"
    font-size="14" fill="${navy}" opacity="0.6">Installed from your home screen · works with the VARSITY brand</text>
</svg>`;
}

const outputs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
  ["favicon-32.png", 32, {}],
  ["favicon-16.png", 16, {}],
];

for (const [name, size, options] of outputs) {
  await sharp(Buffer.from(iconSvg(size, options))).png().toFile(path.join(outDir, name));
}

await sharp(Buffer.from(iconSvg(64))).ico().toFile(path.join(outDir, "favicon.ico"));

await sharp(Buffer.from(screenshotSvg(1280, 720, false)))
  .png()
  .toFile(path.join(outDir, "screenshot-wide.png"));
await sharp(Buffer.from(screenshotSvg(750, 1334, true)))
  .png()
  .toFile(path.join(outDir, "screenshot-narrow.png"));

await writeFile(
  path.join(outDir, "README.md"),
  [
    "# VARSITY PWA artwork",
    "",
    "Generated from `scripts/generate-pwa-assets.mjs` with the project's existing `sharp` dependency.",
    "All artwork is original and uses the VARSITY palette (navy #101D2C, chalk #F4F2E9, lime #C8F169, cobalt #3564E9, coral #F27A5C).",
    "Screenshots are branded layout previews generated locally, not captures of live student data.",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Generated ${outputs.length + 3} VARSITY PWA assets in public/icons.`);
