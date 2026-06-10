# R2 Bucket CORS Configuration

The customer-side photo uploader (returns submission form) makes browser PUT requests directly to R2 via presigned URLs. R2 needs CORS rules that allow PUT from the storefront origin, otherwise the browser blocks the request with "Failed to fetch."

The API token used by the server can't write bucket CORS — it has object permissions only. Set this in the Cloudflare dashboard.

## Steps

1. Cloudflare dashboard → **R2** → bucket `denimisia-media`
2. Settings tab → **CORS Policy** → **Add CORS policy** (or Edit if one exists)
3. Paste this JSON:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3002",
      "https://denimisia.com",
      "https://www.denimisia.com",
      "https://admin.denimisia.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Save. Propagates within ~30 seconds.

## Verifying

After saving, the photo uploader on `/returns/new` should accept files without a "Failed to fetch" error. The browser DevTools network tab will show a successful preflight (OPTIONS 204) followed by a PUT 200 to the presigned URL.

## Why

R2 (S3-compatible) requires explicit CORS allowlist for browser uploads. Server-side uploads (via the AWS SDK) don't trigger CORS, which is why the existing admin uploader has been working through the server proxy — but the new customer-side uploader uses presigned URLs and uploads directly from the browser to save bandwidth.

## Production origins

Update the `AllowedOrigins` array with the real production storefront + admin URLs once they're set. Don't ship `localhost:*` to production CORS policy.
