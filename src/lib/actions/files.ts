"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateTaskFile } from "@/lib/storage/file-validation";
import { createPresignedUpload, inspectObject } from "@/lib/storage/r2-service";
import type { Database } from "@/types/database";
import type { ActionState } from "@/types/domain";

type TaskRow = Database["public"]["Tables"]["class_tasks"]["Row"];

export interface UploadAuthorization extends ActionState {
  fileId?: string;
  objectKey?: string;
  url?: string;
  headers?: Record<string, string>;
  expiresIn?: number;
}

async function resolveTask(
  parentType: "task_reference" | "task_submission",
  parentId: string,
): Promise<TaskRow | null> {
  const supabase = await createClient();
  if (parentType === "task_reference") {
    const { data } = await supabase.from("class_tasks").select("*").eq("id", parentId).maybeSingle();
    return data ?? null;
  }
  const { data: submission } = await supabase
    .from("task_submissions")
    .select("task_id")
    .eq("id", parentId)
    .maybeSingle();
  if (!submission) return null;
  const { data } = await supabase
    .from("class_tasks")
    .select("*")
    .eq("id", submission.task_id)
    .maybeSingle();
  return data ?? null;
}

export async function requestFileUpload(input: {
  parentType: "task_reference" | "task_submission";
  parentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
}): Promise<UploadAuthorization> {
  await requireUser();
  const task = await resolveTask(input.parentType, input.parentId);
  if (!task) {
    return { status: "error", message: "Task or submission not found." };
  }
  if (input.parentType === "task_submission" && task.status !== "published") {
    return { status: "error", message: "This task is not accepting files." };
  }

  const validation = validateTaskFile(
    { filename: input.filename, contentType: input.contentType, byteSize: input.byteSize },
    { allowedTypes: task.allowed_file_types, maxBytes: task.max_file_size_bytes },
  );
  if (!validation.ok) return { status: "error", message: validation.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_file_upload", {
    p_parent_type: input.parentType,
    p_parent_id: input.parentId,
    p_original_filename: validation.file.safeFilename,
    p_content_type: validation.file.expectedContentType,
    p_byte_size: input.byteSize,
  });
  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "Upload could not be authorised.",
    };
  }

  const result = data as { file_id: string; object_key: string };
  try {
    const signed = await createPresignedUpload(
      result.object_key,
      validation.file.expectedContentType,
    );
    return {
      status: "success",
      message: "Upload authorised.",
      fileId: result.file_id,
      objectKey: result.object_key,
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

export async function confirmFileUpload(fileId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("stored_files")
    .select("id, object_key, byte_size, content_type, upload_status, uploader_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { status: "error", message: "Upload record not found." };
  const user = await supabase.auth.getUser();
  if (file.uploader_id !== user.data.user?.id) {
    return { status: "error", message: "You do not own this upload." };
  }
  if (file.upload_status !== "pending") {
    return { status: "success", message: "File already confirmed." };
  }

  try {
    const object = await inspectObject(file.object_key);
    if (!object) {
      return { status: "error", message: "The file was not found in storage. Upload it again." };
    }
    if (object.size <= 0 || object.size > file.byte_size) {
      return {
        status: "error",
        message: "The uploaded file size does not match the authorised size.",
      };
    }
    const { error } = await supabase.rpc("confirm_file_upload", {
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
