import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Bucket, getR2Client } from "@/lib/storage/r2-client";

export const UPLOAD_URL_TTL_SECONDS = 300;
export const DOWNLOAD_URL_TTL_SECONDS = 120;

export interface SignedUpload {
  url: string;
  expiresIn: number;
  headers: Record<string, string>;
}

export interface ObjectInfo {
  size: number;
  contentType: string | null;
  etag: string | null;
}

function safeStorageError(error: unknown): Error {
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  const message = status
    ? `R2 rejected the request (HTTP ${status}). Check the bucket configuration and CORS rules.`
    : "The file storage service is unavailable. Please try again.";
  return new Error(message);
}

export async function createPresignedUpload(
  objectKey: string,
  contentType: string,
): Promise<SignedUpload> {
  try {
    const command = new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
      ContentType: contentType,
    });
    const url = await getSignedUrl(getR2Client(), command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    return {
      url,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      headers: { "Content-Type": contentType },
    };
  } catch (error) {
    throw safeStorageError(error);
  }
}

export async function inspectObject(objectKey: string): Promise<ObjectInfo | null> {
  try {
    const result = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
    );
    return {
      size: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
      etag: result.ETag ?? null,
    };
  } catch (error) {
    const status = (error as { name?: string; $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    if (status === 404 || (error as { name?: string }).name === "NotFound") {
      return null;
    }
    throw safeStorageError(error);
  }
}

export async function createPresignedDownload(
  objectKey: string,
  originalFilename: string,
): Promise<{ url: string; expiresIn: number }> {
  try {
    const command = new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${originalFilename.replace(/["\r\n]/g, "_")}"`,
    });
    const url = await getSignedUrl(getR2Client(), command, {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
    return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
  } catch (error) {
    throw safeStorageError(error);
  }
}
