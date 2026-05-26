# Wedding Photo Upload

A mobile-first wedding guest upload app built with React, Tailwind CSS, Framer Motion, and a Cloudflare Worker that creates short-lived Cloudflare R2 presigned upload URLs.

## Guest Flow

1. Guest scans the QR code and opens the app.
2. Guest enters their full name.
3. Guest taps the upload area and uses the native photo picker.
4. Photos and videos upload directly to R2.
5. Each file stays visible with inline progress, success, retry, or error state.

Files are stored under:

```text
guests/{sanitized-full-name}/{timestamp}-{safe-original-filename}
```

Example:

```text
guests/jane-doe/20260526T165500-photo.jpg
```

## Local Setup

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the Worker with static assets after building:

```bash
npm run build
npm run worker:dev
```

## Cloudflare R2 Setup

Create an R2 bucket and S3-compatible API token, then set Worker secrets:

```bash
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

Set non-secret values in `wrangler.toml` or Cloudflare dashboard environment variables:

```text
R2_BUCKET_NAME=wedding-photo-upload
ALLOWED_ORIGIN=https://your-deployed-domain.example
```

Configure R2 CORS for the deployed app origin:

```json
[
  {
    "AllowedOrigins": ["https://your-deployed-domain.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

For local Worker testing, copy `.dev.vars.example` to `.dev.vars` and fill in real values.

## Validation

The app and Worker both enforce:

- Photos and videos only.
- Maximum file size of `100MB`.
- Safe R2 object keys derived from guest name and original filename.

Run checks:

```bash
npm run typecheck:web
npm run test
npm run build
```
