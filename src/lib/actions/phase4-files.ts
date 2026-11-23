"use server";

import { createClient } from "@/lib/supabase/server";
import { createPresignedDownload, createPresignedUpload, inspectObject } from "@/lib/storage/r2-service";
import type { ActionState } from "@/types/domain";

export interface Phase4UploadAuthorization extends ActionState {
  fileId?: string;
  objectKey?: string;
  url?: string;
  headers?: Record<string, string>;
  expiresIn?: number;
}

export interface Phase4UploadInput {
  parentType: string;
  parentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  visibility?: "private" | "public";
}

/** Reuses the Phase 2/3 R2 client; metadata and authorization live in Phase 4. */
export async function authorizePhase4Upload(input: Phase4UploadInput): Promise<Phase4UploadAuthorization> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_authorize_upload", {
    p_parent_type: input.parentType,
    p_parent_id: input.parentId,
    p_original_filename: input.filename,
    p_content_type: input.contentType,
    p_byte_size: input.byteSize,
    p_visibility: input.visibility ?? "private",
  });
  if (error) return { status: "error", message: error.message || "Upload was not authorised." };
  const payload = data as { fileId?: string; objectKey?: string } | null;
  if (!payload?.objectKey || !payload.fileId) {
    return { status: "error", message: "Upload authorisation did not return an object key." };
  }
  try {
    const signed = await createPresignedUpload(payload.objectKey, input.contentType);
    return {
      status: "success",
      message: "Upload authorised.",
      fileId: payload.fileId,
      objectKey: payload.objectKey,
      url: signed.url,
      headers: signed.headers,
      expiresIn: signed.expiresIn,
    };
  } catch {
    return { status: "error", message: "The file store is not configured for this environment." };
  }
}

export async function confirmPhase4Upload(fileId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("phase4_files").select("object_key,byte_size,upload_status").eq("id", fileId).maybeSingle();
  if (!file) return { status: "error", message: "File record not found." };
  if (file.upload_status === "confirmed") return { status: "success", message: "Upload already confirmed." };
  try {
    const info = await inspectObject(file.object_key);
    if (!info || info.size <= 0 || info.size > file.byte_size) {
      return { status: "error", message: "The uploaded object could not be verified." };
    }
    const { error } = await supabase.rpc("phase4_confirm_upload", {
      p_file_id: fileId,
      p_verified_size: info.size,
      p_verified_content_type: info.contentType,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "success", message: "Upload confirmed." };
  } catch {
    return { status: "error", message: "The file store is not configured for this environment." };
  }
}

export async function createPhase4DownloadUrl(fileId: string): Promise<
  ActionState & { url?: string; expiresIn?: number }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_authorize_download", { p_file_id: fileId });
  if (error) return { status: "error", message: error.message || "Download not authorised." };
  const file = data?.[0];
  if (!file) return { status: "error", message: "File not available." };
  try {
    const signed = await createPresignedDownload(file.object_key, file.original_filename);
    return { status: "success", message: "Signed URL created.", ...signed };
  } catch {
    return { status: "error", message: "The file store is not configured for this environment." };
  }
}
