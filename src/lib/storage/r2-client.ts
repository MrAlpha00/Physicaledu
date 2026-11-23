import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { getR2Config } from "@/lib/env/r2";

let cachedClient: S3Client | null = null;

/** Trusted server-side S3-compatible client for Cloudflare R2. */
export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestHandler: {
      requestTimeout: 15_000,
    },
  });

  return cachedClient;
}

export function getR2Bucket(): string {
  return getR2Config().bucket;
}
