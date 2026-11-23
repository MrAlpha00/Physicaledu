# R2 backup

## Scope

Back up the private Cloudflare R2 bucket used by VARSITY. Objects may include sensitive uploads and must remain private.

## Recommended approach

Use `rclone` with an R2 remote configured from owner-managed credentials, or `aws s3 sync` with R2 endpoint. Example (placeholders only):

```bash
# Configure rclone remote named "r2varsity" using owner-provided credentials.
rclone sync r2varsity:BUCKET_NAME /secure-backup/r2/BUCKET_NAME --checksum --metadata
```

Or AWS CLI style:

```bash
aws s3 sync s3://BUCKET_NAME /secure-backup/r2/BUCKET_NAME \
  --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com
```

## Rules

- Do not make backup bucket public.
- Encrypt backup storage at rest.
- Preserve object keys; app references keys in DB.
- Test restore by restoring a sample object to a scratch bucket and verifying signed download through app flow.
- Never commit R2 credentials.
