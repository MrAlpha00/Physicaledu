# Cloudflare R2 setup

R2 stores **task reference and student submission files** for Phase 2. Supabase
stores the metadata, permissions and audit trail; R2 stores only object bytes.
The bucket must be private.

## Environment variables

Add these names to `.env` with real values; keep `.env` ignored and never commit
or display values. `.env.example` contains the names with empty placeholders.

| Name | Scope | Purpose |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Server only | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Server only | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Server only | R2 API token secret |
| `R2_BUCKET_NAME` | Server only | Private bucket name |
| `R2_ENDPOINT` | Server only | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

`src/lib/env/r2.ts` reports missing variables **by name only**. Never use a
`NEXT_PUBLIC_` prefix for any R2 credential and never import the R2 client into
a Client Component.

## Create the bucket and token

1. In Cloudflare, create an R2 bucket for PE files (for example
   `varsity-pe-files`). Do **not** enable public access.
2. Create an R2 API token scoped to that single bucket with **Object Read &
   Write** permission. Copy the access key ID and secret into `.env`.
3. Set `R2_ENDPOINT` to the S3-compatible endpoint for the account. It must be
   an `https://` URL.
4. Restart the development server (or redeploy) after changing environment
   variables.

## CORS for browser uploads

The browser uploads directly to R2 with a presigned `PUT`. Configure bucket CORS
for every origin that uses the app, for example `http://localhost:3000` and the
deployed HTTPS origin:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-deployed-origin.example"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type", "x-amz-*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace the example origin with the real value of `NEXT_PUBLIC_SITE_URL`. If a
different port or preview domain is used, add that origin too. Do not use
`*` for a private production bucket.

## Upload and download flow

1. The client calls `requestFileUpload()` with parent type, parent ID, filename,
   MIME hint and byte size.
2. The server re-validates the extension against the task's allowlist, derives
   the expected content type, authorises the size and calls the
   `create_file_upload` RPC. This creates a `stored_files` row with status
   `pending` and an authoritative object key.
3. The server creates a presigned `PUT` URL valid for 5 minutes and returns it
   to the browser. The browser uploads the bytes directly to R2.
4. The client calls `confirmFileUpload()`. The server performs a server-side
   `HEAD` on the object, confirms the real size and content type and calls the
   `confirm_file_upload` RPC, which marks the row `confirmed`.
5. `/api/files/[id]/download` checks the session and RLS, then returns a 302
   redirect to a presigned `GET` URL valid for 2 minutes.

Dangerous extensions (executables, scripts, HTML/SVG) are rejected regardless
of task settings. The authoritative check is the sanitised extension plus the
derived content type, not the browser-provided MIME string.

## Security notes

- Keep the bucket private. Public bucket URLs bypass the application's RLS and
  short-lived URL design.
- Presigned URLs are intentionally short-lived. If an upload or download fails
  after expiry, request a new one.
- Do not copy presigned URLs, tokens or R2 credentials into `audit_logs`, UI
  messages or client props.
- The metadata row is the source of truth for ownership and visibility. RLS
  policies allow admins, the uploader and eligible students with published task
  references.

## Manual test checklist

1. Create a task with file submissions allowed and one allowed extension.
2. As PE Admin, attach a reference file; confirm the row becomes `confirmed`.
3. As an eligible student, submit a valid file; confirm it is visible to the
   student and admin.
4. Try a disallowed extension and an oversized file; both must be rejected.
5. Open the download link while signed in; it must redirect to R2 and download
   the original filename with the correct content type.
6. Sign out and retry the download; it must be denied.

No live R2 upload/download was performed by the development session because
bucket credentials and project data were not available.
