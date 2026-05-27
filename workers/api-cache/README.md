# denimisia-api-cache (Cloudflare Worker)

Caches public catalog GETs from the NestJS API at the Cloudflare edge so Render
free-plan cold starts (15-min spin-down) are invisible to customers.

## What it caches

Allowlist in [src/index.js](src/index.js):

- `/api/v1/products`, `/categories`, `/collections`, `/series`, `/bundles`
- `/api/v1/campaigns`, `/new-arrivals`, `/trending`, `/featured`
- `/api/v1/cms/sections`

TTL: 60 seconds at the edge, matches the API's own `s-maxage=60` header.

## What it never caches

- Auth, admin, user-specific paths: `/auth`, `/admin`, `/users`, `/orders`,
  `/cart`, `/wishlist`, `/inbox`, `/handoff`, `/returns`
- Media routes: `/uploads`, `/media`
- Server-Sent Events: `/sse`
- Health/ready probes
- Anything not in the allowlist
- Any non-GET method (POST/PUT/PATCH/DELETE all pass through)

## Safety

Any error in cache logic falls through to a direct origin `fetch` — the Worker
cannot make the API less available than today's baseline.

## Deploy

Already deployed. Triggered by Workers Route binding on
`api.denimisiabd.com/*` (zone `denimisiabd.com`).

To redeploy after source changes, upload via Cloudflare API with a token that
has `Account · Workers Scripts · Edit`:

```sh
CF_TOKEN=$(cat cloudflare-token.txt)
ACCT=962f39dabcbf446b16f43a97ee1ea6b6
curl -X PUT \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata={\"main_module\":\"index.js\",\"compatibility_date\":\"2024-09-01\"};type=application/json" \
  -F "index.js=@workers/api-cache/src/index.js;type=application/javascript+module" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/workers/scripts/denimisia-api-cache"
```

## Rollback

Delete the Workers Route binding via the Cloudflare dashboard or API:

```sh
ZONE=24fc44c326cf154747d3b2cd282f73c8
# List routes to find the ID
curl -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes"
# Delete by ID
curl -X DELETE -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/workers/routes/<route-id>"
```

Traffic resumes going direct to origin within ~30 seconds. The Worker script
itself can stay deployed — only the route binding routes traffic through it.

## Observability

Every Worker response includes:

- `X-Cache-Worker: denimisia-api-cache`
- `X-Cache-Status: HIT | MISS | MISS-NOCACHE | BYPASS-ERROR`

Use these to verify cache behavior:

```sh
curl -sSI https://api.denimisiabd.com/api/v1/products | grep -i x-cache
```
