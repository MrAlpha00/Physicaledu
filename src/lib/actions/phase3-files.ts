"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateTaskFile } from "@/lib/storage/file-validation";
import {
  createPresignedDownload,
  createPresignedUpload,
  inspectObject,
} from "@/lib/storage/r2-service";
import type { Phase3ParentType } from "@/types/database";
import type { ActionState } from "@/types/domain";

export interface Phase3UploadAuthorization extends ActionState {
  fileId?: string;
  objectKey?: string;
  url?: string;
  headers?: Record<string, string>;
  expiresIn?: number;
}

export interface Phase3UploadInput {
  parentType: Phase3ParentType;
  parentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  visibility?: "private" | "public";
}

const IMAGE_ONLY: Phase3ParentType[] = [
  "equipment_image", "maintenance_photo", "game_rule_image", "sports_profile_photo",
];

export async function authorizePhase3Upload(input: Phase3UploadInput): Promise<Phase3UploadAuthorization> {
  const user = await requireUser();
  void user;

  const imageOnly = IMAGE_ONLY.includes(input.parentType);
  const validation = validateTaskFile(
    { filename: input.filename, contentType: input.contentType, byteSize: input.byteSize },
    { allowedTypes: imageOnly ? ["jpg", "jpeg", "png", "webp"] : undefined },
  );
  if (!validation.ok) return { status: "error", message: validation.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_phase3_upload", {
    p_parent_type: input.parentType,
    p_parent_id: input.parentId,
    p_original_filename: validation.file.safeFilename,
    p_content_type: validation.file.expectedContentType,
    p_byte_size: input.byteSize,
    p_visibility: input.visibility ?? "private",
  });
  if (error || !data?.length) {
    return { status: "error", message: error?.message ?? "Upload could not be authorised." };
  }

  try {
    const signed = await createPresignedUpload(data[0].object_key, validation.file.expectedContentType);
    return {
      status: "success",
      message: "Upload authorised.",
      fileId: data[0].file_id,
      objectKey: data[0].object_key,
      url: signed.url,
      headers: signed.headers,
      expiresIn: signed.expiresIn,
    };
  } catch (storageError) {
    return {
      status: "error",
      message: storageError instanceof Error ? storageError.message : "Storage is unavailable.",
    };
  }
}

export async function confirmPhase3Upload(fileId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("phase3_files")
    .select("id, object_key, byte_size, content_type, upload_status, uploader_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { status: "error", message: "Upload record not found." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (file.uploader_id !== user?.id) {
    return { status: "error", message: "You do not own this upload." };
  }
  if (file.upload_status !== "pending") {
    return { status: "success", message: "File already confirmed." };
  }

  try {
    const object = await inspectObject(file.object_key);
    if (!object) return { status: "error", message: "The file was not found in storage. Upload it again." };
    if (object.size <= 0 || object.size > file.byte_size) {
      return { status: "error", message: "The uploaded file size does not match the authorised size." };
    }

    const { error } = await supabase.rpc("confirm_phase3_upload", {
      p_file_id: fileId,
      p_verified_size: object.size,
      p_verified_content_type: object.contentType ?? file.content_type,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "success", message: "File uploaded and verified." };
  } catch (storageError) {
    return {
      status: "error",
      message: storageError instanceof Error ? storageError.message : "Storage is unavailable.",
    };
  }
}

export async function createPhase3DownloadUrl(fileId: string): Promise<ActionState & { url?: string; expiresIn?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_phase3_download", { p_file_id: fileId });
  if (error) return { status: "error", message: error.message };
  const file = data?.[0];
  if (!file) return { status: "error", message: "This file is not available to you." };

  try {
    const signed = await createPresignedDownload(file.object_key, file.original_filename);
    return { status: "success", message: "Download authorised.", url: signed.url, expiresIn: signed.expiresIn };
  } catch (storageError) {
    return {
      status: "error",
      message: storageError instanceof Error ? storageError.message : "Storage is unavailable.",
    };
  }
}
