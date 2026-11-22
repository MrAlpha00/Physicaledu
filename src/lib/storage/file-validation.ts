/**
 * Server-side file rules for R2-backed task files. Browser-provided MIME types
 * are only a hint: the extension allowlist is authoritative, and object headers
 * are re-checked after upload with a HEAD request.
 */

const CONTENT_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  txt: ["text/plain"],
};

export const DEFAULT_ALLOWED_TYPES = Object.keys(CONTENT_TYPES);
export const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_MAX_FILES = 10;

/** Formats that must never be accepted even if a task tries to allow them. */
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "msi", "scr", "js", "mjs", "cjs", "vbs",
  "ps1", "sh", "bash", "php", "phtml", "jsp", "asp", "aspx", "jar", "war",
  "svg", "html", "htm", "xhtml", "swf", "hta", "reg", "lnk", "iso", "img",
]);

export interface FileCandidate {
  filename: string;
  contentType?: string | null;
  byteSize: number;
}

export interface ValidatedFile extends FileCandidate {
  extension: string;
  safeFilename: string;
  expectedContentType: string;
}

export type FileValidationResult =
  | { ok: true; file: ValidatedFile }
  | { ok: false; error: string };

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  return base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200) || "file";
}

export function validateTaskFile(
  candidate: FileCandidate,
  options: {
    allowedTypes?: string[];
    maxBytes?: number;
  } = {},
): FileValidationResult {
  const allowed = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_FILE_BYTES;
  const safeFilename = sanitizeFilename(candidate.filename ?? "");
  const extension = safeFilename.includes(".")
    ? safeFilename.split(".").pop()!.toLowerCase()
    : "";

  if (!extension || !CONTENT_TYPES[extension]) {
    return { ok: false, error: "Unsupported file type." };
  }
  if (DANGEROUS_EXTENSIONS.has(extension) || !allowed.includes(extension)) {
    return { ok: false, error: "That file type is not permitted for this task." };
  }
  if (!Number.isFinite(candidate.byteSize) || candidate.byteSize <= 0) {
    return { ok: false, error: "The file is empty or has an invalid size." };
  }
  if (candidate.byteSize > maxBytes) {
    return {
      ok: false,
      error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }

  const expectedContentType = CONTENT_TYPES[extension][0];
  const supplied = (candidate.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (supplied && supplied !== "application/octet-stream" && supplied !== expectedContentType) {
    return { ok: false, error: "File content type does not match its extension." };
  }

  return {
    ok: true,
    file: {
      ...candidate,
      extension,
      safeFilename,
      expectedContentType,
    },
  };
}

export function humanFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
