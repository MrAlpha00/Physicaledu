# Cloudflare R2 production setup

## Owner actions

1. Create private R2 bucket.
2. Create least-privilege API token for object read/write/list as required by app.
3. Set CORS only for required origins/methods/headers; avoid wildcard origins in production.
4. Configure env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.
5. Validate signed upload/download flows and file type/size checks.

## Security

- Bucket remains private.
- No public ACLs.
- Presigned URLs short-lived.
- Payment proofs and private files never cached by PWA.

## Verification

- Upload allowed file type/size succeeds.
- Oversized/invalid type rejected.
- Download requires authorization and uses signed URL.
- Objects not publicly listable.
