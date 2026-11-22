import QRCode from "qrcode";
import { QR_THEMES } from "@/lib/qr/qr-config";

const QR_SIZE = 540;
const QR_PANEL = 640;
const POSTER_WIDTH = 900;
const POSTER_HEIGHT = 1270;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Deterministic, print-ready A4-style SVG poster with a clean QR quiet zone. */
export function renderQrPosterSvg(options: {
  destination: string;
  title: string;
  theme: string;
}): string {
  const theme = QR_THEMES[options.theme] ?? QR_THEMES.entrance;
  const matrix = QRCode.create(options.destination, { errorCorrectionLevel: "M" }).modules;
  const moduleCount = matrix.size;
  const cell = QR_SIZE / moduleCount;
  const originX = (POSTER_WIDTH - QR_SIZE) / 2;
  const originY = 372;

  let modules = "";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (matrix.get(column, row)) {
        modules += `<rect x="${(originX + column * cell).toFixed(2)}" y="${(
          originY +
          row * cell
        ).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#101D2C"/>`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${escapeXml(
    options.title,
  )} QR poster">
  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="${theme.background}"/>
  <rect x="0" y="0" width="${POSTER_WIDTH}" height="18" fill="${theme.accent}"/>
  <circle cx="790" cy="150" r="190" fill="${theme.accent}" opacity="0.12"/>
  <circle cx="105" cy="1030" r="160" fill="${theme.accent}" opacity="0.10"/>
  <text x="72" y="104" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" letter-spacing="4" fill="${theme.accent}">${escapeXml(
    theme.kicker,
  )}</text>
  <text x="72" y="200" font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-size="76" font-weight="800" fill="${theme.ink}">${escapeXml(
    options.title.toUpperCase(),
  )}</text>
  <rect x="72" y="240" width="120" height="8" fill="${theme.accent}"/>
  <text x="72" y="300" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${theme.ink}" opacity="0.85">${escapeXml(
    theme.instructions,
  )}</text>
  <rect x="${(POSTER_WIDTH - QR_PANEL) / 2}" y="${originY - 50}" width="${QR_PANEL}" height="${QR_PANEL}" rx="12" fill="#FFFFFF"/>
  <rect x="${(POSTER_WIDTH - QR_PANEL) / 2}" y="${originY - 50}" width="${QR_PANEL}" height="${QR_PANEL}" rx="12" fill="none" stroke="${theme.accent}" stroke-width="6"/>
  ${modules}
  <text x="${POSTER_WIDTH / 2}" y="1080" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" fill="${theme.ink}">VARSITY · PE DEPARTMENT</text>
  <text x="${POSTER_WIDTH / 2}" y="1122" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="${theme.ink}" opacity="0.7">Scan with a phone camera · Camera access may be required</text>
  <rect x="72" y="1180" width="${POSTER_WIDTH - 144}" height="2" fill="${theme.ink}" opacity="0.25"/>
  <text x="72" y="1225" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${theme.ink}" opacity="0.6">Print at 100% scale · Keep the white QR margin clear</text>
</svg>`;
}

export async function renderQrPosterPng(options: {
  destination: string;
  title: string;
  theme: string;
}): Promise<Buffer> {
  const svg = renderQrPosterSvg(options);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
