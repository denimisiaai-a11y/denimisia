# Denimisia SEO & Ads Infrastructure — Design Spec

**Date:** 2026-04-23
**Status:** Approved design, pending implementation plan
**Reviewers:** Codex (gpt-5.4, high reasoning), Kimi
**Scope owner:** `apps/web` (Next.js 14 App Router) + `apps/api` (NestJS)

---

## 1. Goals

Ship a full-stack SEO, analytics, and paid-ads infrastructure that:

1. Achieves best-practice technical SEO: canonical URLs, `metadataBase`, split paginated sitemaps, `robots.txt`, structured data for products/collections/articles, hreflang, clean OG/Twitter metadata.
2. Captures accurate measurement for Meta Ads and Google Ads via hardcoded client-side tags **and** authoritative server-side Conversions (Meta CAPI + Google Ads Enhanced Conversions) originated from NestJS.
3. Publishes Google Merchant and Meta Commerce Manager product feeds from `apps/api` → R2 → CDN, consumable by Performance Max and Advantage+ Catalog Ads.
4. Stays performant on Bangladesh 4G mobile: no GTM container, scripts staggered by load strategy, no dynamic OG font downloads.
5. Remains privacy-aware via Consent Mode v2 with an always-present banner (single-market BD defaults but toggle-ready for expansion).

## 2. Non-goals

- Multi-locale content (English-only, BD-only).
- Server-side Google Tag Manager on Cloud Run (sGTM) — revisit when paid-media volume justifies ops cost (~$45/mo/instance).
- Privacy Sandbox APIs (Topics, Protected Audience, Attribution Reporting) — monitor, don't implement.
- iOS SKAdNetwork — no native app in scope.
- MDX migration of existing blog bodies — deferred (noted in phase 6).
- Mandatory review/rating UI for products — `AggregateRating` emits only when `reviewCount > 0`.

## 3. Architecture

### 3.1 Layer A — Static SEO (no JS)

| Path | Purpose |
|---|---|
| `apps/web/config/brand.ts` | Brand identity single source (name, logo, socials, contact). Placeholders acceptable on day 1. |
| `apps/web/config/commerce-policies.ts` | Return window, shipping rates, delivery time. Drives `MerchantReturnPolicy` and `OfferShippingDetails`. |
| `apps/web/lib/seo/metadata.ts` | Shared types, `metadataBase`, default OG/Twitter, default robots. |
| `apps/web/lib/seo/canonical.ts` | Per-route query-param allowlist. Strips tracking/filter params when building canonical URL. |
| `apps/web/lib/seo/truncate.ts` | Word-boundary safe truncation for descriptions. |
| `apps/web/lib/seo/product.ts` | `generateProductMetadata(product)` factory — PDP metadata. |
| `apps/web/lib/seo/collection.ts` | `generateCollectionMetadata(collection)` factory. |
| `apps/web/lib/seo/blog.ts` | `generateBlogMetadata(post)` factory. |
| `apps/web/lib/seo/bundle.ts` | `generateBundleMetadata(bundle)` factory. |
| `apps/web/lib/seo/defaults.ts` | Fallback metadata for any route. |
| `apps/web/lib/seo/jsonld/organization.ts` | Organization schema builder. |
| `apps/web/lib/seo/jsonld/website.ts` | WebSite + `SearchAction`. |
| `apps/web/lib/seo/jsonld/product.ts` | Product + Offer + ProductGroup + OfferShippingDetails + MerchantReturnPolicy. |
| `apps/web/lib/seo/jsonld/breadcrumb.ts` | BreadcrumbList for PDP/PLP/blog. |
| `apps/web/lib/seo/jsonld/item-list.ts` | ItemList for collection pages. |
| `apps/web/lib/seo/jsonld/article.ts` | Article schema for blog posts. |
| `apps/web/lib/seo/jsonld/local-business.ts` | Store schema for office showroom. |
| `apps/web/lib/seo/jsonld/faq.ts` | FAQPage — emits ONLY when FAQ visible on the page. |
| `apps/web/app/robots.ts` | Allow-all + sitemap index pointer. No `/api/*` disallow. |
| `apps/web/app/sitemap-index.xml/route.ts` | Master sitemap index. |
| `apps/web/app/sitemap-products.xml/route.ts` | Cursor-paginated, consumes new `/products/slugs` endpoint. |
| `apps/web/app/sitemap-collections.xml/route.ts` | Collections sitemap. |
| `apps/web/app/sitemap-blog.xml/route.ts` | Blog posts sitemap. |
| `apps/web/app/sitemap-pages.xml/route.ts` | Static pages sitemap (about, contact, etc.). |
| `apps/web/app/opengraph-image.tsx` | Homepage dynamic OG with module-scope cached font buffer. |
| `apps/web/app/(marketing)/opengraph-image.tsx` | Group-level OG for marketing pages. |
| `apps/api/src/products/products.controller.ts` | **New endpoint** `GET /products/slugs?cursor=&limit=1000` returning `{slug, updatedAt, firstImage}[]` + `nextCursor`. |
| `apps/api/src/common/middleware/robots-header.middleware.ts` | Sets `X-Robots-Tag: noindex` on all non-HTML responses globally. |

**PDP OG images** use real product photos via `metadata.openGraph.images` — no `ImageResponse` on product routes.

**Route-level `robots`** applied via metadata on thin/private pages (`/account/*`, `/checkout/*`, `/wishlist/[token]`, `/verify-email`, `/reset-password`, `/forgot-password`): `{ index: false, follow: false }`.

**Sitemap quality rules:**
- Products: only canonical, in-stock, published URLs.
- Collections: only non-empty published collections.
- Blog: only published posts.
- All entries carry real `lastModified` from the API.
- Image metadata included where the schema supports it.

### 3.2 Layer B — Client tracking (hardcoded, no GTM)

| Path | Purpose |
|---|---|
| `apps/web/components/analytics/ga4.tsx` | Loads gtag.js `afterInteractive`. Inits with `send_page_view: false`. Declares Consent Mode v2 defaults BEFORE gtag loads via inline script. |
| `apps/web/components/analytics/meta-pixel.tsx` | Loads fbq base code `lazyOnload`. Consent-gated. |
| `apps/web/components/analytics/google-ads-tag.tsx` | Loads Google Ads conversion tag `lazyOnload` (elevated to `afterInteractive` on `/checkout/success`). |
| `apps/web/components/consent/consent-provider.tsx` | Client context provider managing consent state (granted/denied per category). Persists to `localStorage`. |
| `apps/web/components/consent/consent-banner.tsx` | Minimal banner: "Accept all" / "Customize" / dismiss. Auto-treat-as-denied if no interaction after 7 days. |
| `apps/web/components/consent/consent-modal.tsx` | Category toggles: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`. |
| `apps/web/lib/analytics/events.ts` | Typed event API: `trackViewItem`, `trackAddToCart`, `trackRemoveFromCart`, `trackBeginCheckout`, `trackAddPaymentInfo`, `trackPurchase`, `trackLead`, `trackSearch`, `trackSignUp`, `trackLogin`. Each fans out to GA4 + Pixel + Google Ads. Events are buffered while consent pending and flushed on grant. |
| `apps/web/lib/analytics/event-id.ts` | Event ID rules (see §5). |
| `apps/web/lib/analytics/utm.ts` | Persists `utm_*`, `gclid`, `wbraid`, `gbraid`, `fbclid`, `ttclid` to `sessionStorage` on first landing; hydrates every event. |
| `apps/web/lib/analytics/consent.ts` | Client helpers: `getConsent`, `setConsent`, `whenGranted(cb)`. |
| `apps/web/hooks/use-page-view.ts` | Fires `page_view` once per committed `pathname + search`. Sole pageview owner (GA4 auto `send_page_view` is disabled). |
| `apps/web/hooks/use-track-event.ts` | Component-friendly wrapper exposing typed event API. |

**Consent defaults (v2):**
```
ad_storage: 'denied'
ad_user_data: 'denied'
ad_personalization: 'denied'
analytics_storage: 'denied'
functionality_storage: 'granted'
security_storage: 'granted'
wait_for_update: 500
```
On grant: call `gtag('consent','update', ...)` + `fbq('consent','grant')`, then flush buffered events.

**Load strategy per tag:**
- `ga4.tsx`: `afterInteractive` — needed early for consent init + first page_view.
- `meta-pixel.tsx`: `lazyOnload` — deferred past LCP. Client Pixel only supports browser events + dedup; authoritative purchase events fire from NestJS.
- `google-ads-tag.tsx`: `lazyOnload` site-wide, bumped to `afterInteractive` exclusively on `/checkout/success` so the conversion tag is definitely live before the page unloads.

### 3.3 Layer C — Authoritative server conversions (NestJS)

| Path | Purpose |
|---|---|
| `apps/api/src/tracking/tracking.module.ts` | New NestJS module. |
| `apps/api/src/tracking/outbox.entity.ts` | Prisma model `TrackingOutbox { id, eventId, eventName, platform, payload JSON, status, attempts, lastError, createdAt, processedAt }`. |
| `apps/api/src/tracking/outbox.service.ts` | Insert events into outbox **within the same tx** as the source write (order paid, user registered, etc.). |
| `apps/api/src/tracking/outbox.worker.ts` | Background worker (`@nestjs/schedule` cron every 30s) drains pending events, retries with exponential backoff (1s, 5s, 30s, 5m, 30m, 2h), dead-letters after 8 attempts. |
| `apps/api/src/tracking/meta-capi.service.ts` | Meta Conversions API adapter. SHA-256 hashes `em`, `ph`, `fn`, `ln`, `ge`, `db`, `ct`, `st`, `zp`, `country`. Idempotent via `event_id`. Sends `event_source_url`, `action_source: 'website'`, `user_data.fbc`, `user_data.fbp`, `user_data.client_ip_address`, `user_data.client_user_agent`. |
| `apps/api/src/tracking/google-ads.service.ts` | Google Ads Enhanced Conversions adapter via Google Ads API. Requires OAuth; uses captured `gclid`/`wbraid`/`gbraid` with fallback to Enhanced Conversions for Leads when click ID absent. |
| `apps/api/src/tracking/event-id.util.ts` | `sha256(orderId + eventName + eventTimeUnix)` for deterministic conversion event IDs. Matches client event ID for Pixel dedup. |
| `apps/api/src/tracking/click-id.cookie.ts` | Parses click ID cookies on order creation. |
| `apps/api/src/tracking/customer-match.job.ts` | Weekly `@nestjs/schedule` cron: hash all opted-in customer emails/phones and push to Google Ads Customer Match + Meta Custom Audiences. |
| `apps/web/middleware.ts` (extend existing) | Captures `gclid`, `wbraid`, `gbraid`, `fbclid`, `ttclid`, `utm_*` from landing URL into `HttpOnly` cookies (`_dnm_gclid`, `_dnm_fbc`, etc.). 90-day TTL. Forwarded by client on order creation. |
| `apps/web/app/api/track/route.ts` | Low-authority client events only (newsletter signup, search). `export const dynamic = 'force-dynamic'`, `Cache-Control: no-store`, rate-limited (10 req/min/IP via upstash or in-memory). Not a conversion surface. |

**Order-paid flow:**
```
Stripe/bKash/etc webhook → orders.service.markPaid(order)
  ↓ (same DB tx)
  INSERT INTO tracking_outbox (event_id, event_name, platform, payload)
    VALUES (sha256(orderId+'Purchase'+ts), 'Purchase', 'meta_capi', {...})
  INSERT INTO tracking_outbox (event_id, event_name, platform, payload)
    VALUES (sha256(orderId+'conversion'+ts), 'conversion', 'google_ads', {...})
  ↓ commit
outbox.worker (every 30s)
  → Meta CAPI POST /events (Purchase)
  → Google Ads uploadClickConversions (mutate)
  → mark row status=sent
```

Client Pixel still fires `Purchase` on `/checkout/success` with the **same deterministic event_id** — Meta dedupes by `event_id + event_name`.

### 3.4 Layer D — Product feeds (NestJS → R2 → CDN)

| Path | Purpose |
|---|---|
| `apps/api/src/feeds/feeds.module.ts` | New module. |
| `apps/api/src/feeds/google-merchant.generator.ts` | Emits XML feed (Google product schema). One entry per variant with `<g:item_group_id>`. |
| `apps/api/src/feeds/meta-catalog.generator.ts` | Emits CSV (RFC 4180) for Meta Commerce Manager. One row per variant, `item_group_id` column. |
| `apps/api/src/feeds/feeds.cron.ts` | Hourly `@nestjs/schedule` cron: generate both feeds → upload to R2 bucket `denimisia-feeds` at `/google-merchant.xml` and `/meta-catalog.csv`. Public R2 URLs. |
| `apps/api/src/feeds/r2-upload.service.ts` | R2 S3-compatible client; you already have R2 creds per prior sessions. |

**Merchant Center setup:** point scheduled fetch at `https://feeds.denimisia.com/google-merchant.xml` (or whatever the R2 public URL resolves to).

**Meta Commerce Manager setup:** point scheduled fetch at `https://feeds.denimisia.com/meta-catalog.csv`, fetch every 4 hours.

**Next.js never serves the feed.** No function time consumed, no Vercel cold starts, bot traffic hits R2/CDN directly.

## 4. Canonical product contract

Every SEO/tracking/feed surface consumes a single shape:

```ts
// apps/api/src/products/product-presentation.contract.ts
export interface ProductPresentation {
  id: string;                     // stable product ID
  slug: string;                   // URL slug
  canonicalUrl: string;           // https://denimisia.com/products/<slug>
  name: string;
  description: string;
  brand: string;                  // 'Denimisia'
  gender: 'men' | 'women' | 'unisex';
  googleProductCategory: string;  // numeric ID, e.g., '1604' (Apparel > Pants)
  condition: 'new' | 'refurbished' | 'used';
  images: { url: string; alt: string }[];
  variants: ProductVariant[];
  hasAnyInStock: boolean;
  averageRating?: number;         // undefined unless reviewCount > 0
  reviewCount: number;            // 0 OK
  updatedAt: string;              // ISO
}

export interface ProductVariant {
  id: string;
  sku: string;
  itemGroupId: string;            // shared across variants of a product
  gtin?: string;
  mpn?: string;
  priceBdt: number;
  salePriceBdt?: number;
  currency: 'BDT';
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  size?: string;
  color?: string;
  material?: string;
  pattern?: string;
  imageUrl: string;
}
```

New endpoint `GET /products/:slug/presentation` returns this exact shape. Consumed by:
- `generateProductMetadata` (metadata + OG)
- `productJsonLd` (JSON-LD Product + ProductGroup)
- `google-merchant.generator`
- `meta-catalog.generator`
- Client `trackViewItem` payload hydration
- Meta CAPI `content_ids` / `contents[]`

A single change to price/availability in the product table propagates to all seven surfaces on next revalidation / next feed generation.

**Variant strategy:** one canonical PDP per product, variants selectable via client UI. JSON-LD emits `ProductGroup` with `hasVariant[]`. Feeds emit one row per variant sharing `item_group_id`.

## 5. Event identity model

Event ID generation rules — **never at render time**, never inside ISR HTML, never from `Math.random()` or `Date.now()` alone.

| Event | ID source |
|---|---|
| `page_view` | `crypto.randomUUID()` generated in `useEffect` after mount |
| `view_item` | `crypto.randomUUID()` generated in `useEffect` after product data loaded |
| `add_to_cart` | `crypto.randomUUID()` generated **inside the click handler** |
| `remove_from_cart` | UUID from click handler |
| `begin_checkout` | `crypto.randomUUID()` inside the "proceed to checkout" click handler |
| `add_payment_info` | UUID from payment form submit handler |
| `purchase` (client) | `sha256(orderId + 'Purchase' + orderPaidAt.getTime())` — **deterministic** |
| `purchase` (server via outbox) | Same formula — **matches client for Meta dedup** |
| `lead` (newsletter) | UUID at submit handler |
| `search` | UUID at search debounce fire |
| `sign_up` / `login` | UUID at form submit |

**Cache discipline:**
- `/api/track` → `Cache-Control: no-store, max-age=0`.
- `/api/track` → `export const dynamic = 'force-dynamic'` + `export const fetchCache = 'force-no-store'`.
- Event IDs never included in any `generateMetadata`, JSON-LD, OG image, sitemap, or ISR-rendered HTML.

## 6. Consent model

Banner present on day one. BD default posture is "educate and accept fast"; implementation is fully toggle-ready for stricter jurisdictions.

**Default state (v2):** all ad/analytics categories `denied`, functionality/security `granted`, `wait_for_update: 500`.

**Banner UX:**
- Appears bottom-fixed on first visit.
- Copy: "We use cookies to improve your shopping experience and to show relevant ads. [Accept all] [Customize] [Decline]"
- Auto-dismiss countdown of 7 days if no interaction → remains denied.
- `localStorage` key `denim_consent_v1` stores `{status, grantedCategories[], updatedAt}`.

**On grant:**
1. `gtag('consent', 'update', { ad_storage: 'granted', ... })`
2. `fbq('consent', 'grant')`
3. Replay buffered events from `events.ts` in-memory queue.
4. Lazy-loaded Pixel and Ads tags are loaded if not yet loaded.

**Toggle to stricter posture (future):** flip `config/consent.ts` `defaultPosture = 'explicit'` — no other changes required.

## 7. Environment variables

Validated at boot via shared zod schema.

| Var | App | Required | Example | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | web | no (graceful skip) | `G-XXXXXXXXXX` | Public tag ID |
| `NEXT_PUBLIC_META_PIXEL_ID` | web | no | `1234567890123456` | Public tag ID |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | web | no | `AW-123456789` | Public tag ID |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` | web | no | `AW-123456789/AbC_XYZ` | Public, per conversion |
| `NEXT_PUBLIC_SITE_URL` | web | yes | `https://denimisia.com` | Used for `metadataBase` |
| `META_CAPI_ACCESS_TOKEN` | api | no | `EAAB...` | Server-only secret |
| `META_PIXEL_ID` | api | no | same | Server copy for CAPI |
| `META_CATALOG_ID` | api | no | `1234...` | For Commerce Manager |
| `META_TEST_EVENT_CODE` | api | no | `TEST12345` | Optional CAPI testing |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | api | no | `xxx` | Server-only secret |
| `GOOGLE_ADS_CUSTOMER_ID` | api | no | `123-456-7890` | |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | api | no | | Manager account if applicable |
| `GOOGLE_ADS_CLIENT_ID` | api | no | | OAuth |
| `GOOGLE_ADS_CLIENT_SECRET` | api | no | | OAuth |
| `GOOGLE_ADS_REFRESH_TOKEN` | api | no | | OAuth |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | api | no | `customers/XXX/conversionActions/YYY` | |
| `GOOGLE_MERCHANT_ID` | api | no | | Phase 6 Merchant API |
| `R2_FEEDS_BUCKET` | api | yes | `denimisia-feeds` | Already have R2 per prior sessions |
| `R2_FEEDS_PUBLIC_URL` | api | yes | `https://feeds.denimisia.com` | |
| `GOOGLE_SITE_VERIFICATION` | web | no | | Search Console meta tag |
| `META_DOMAIN_VERIFICATION` | web | no | | Meta Business domain verify |

All marketing env vars are optional at boot — when absent, the corresponding tag does not load and events no-op silently (logged in dev). Infrastructure ships live without any ID; drop IDs in and it lights up.

## 8. Configuration files

### 8.1 `apps/web/config/brand.ts`

```ts
// PLACEHOLDER values — replace with real data before launch.
export const brand = {
  legalName: 'Denimisia', // TODO: set legal entity name
  displayName: 'Denimisia',
  tagline: 'Premium denim and essentials. Crafted to last.',
  logo: {
    url: 'https://denimisia.com/brand/logo.png', // TODO
    width: 512,
    height: 512,
  },
  socialProfiles: [
    // TODO: fill in real URLs; empty entries are filtered out
    'https://www.facebook.com/denimisia',
    'https://www.instagram.com/denimisia',
  ],
  contact: {
    email: 'hello@denimisia.com', // TODO
    phone: '+8801XXXXXXXXX',       // TODO
  },
  office: {
    streetAddress: 'TBD',          // TODO
    addressLocality: 'Dhaka',
    addressRegion: 'Dhaka',
    postalCode: 'TBD',             // TODO
    addressCountry: 'BD',
    geo: { latitude: 23.8103, longitude: 90.4125 }, // TODO: precise
    openingHours: 'Mo-Sa 10:00-20:00', // TODO
    note: 'Showroom for product try-on by appointment',
  },
} as const;
```

### 8.2 `apps/web/config/commerce-policies.ts`

```ts
export const commercePolicies = {
  returnWindow: { value: 7, unit: 'DAY' as const },
  returnFees: {
    method: 'CUSTOMER_PAYS' as const, // customer pays return shipping
  },
  returnPolicyUrl: 'https://denimisia.com/returns',
  deliveryTime: {
    handlingMin: 1,
    handlingMax: 1,
    transitMin: 3,
    transitMax: 5,
    unit: 'DAY' as const,
  },
  shippingRate: {
    freeOverBdt: 3000,
    flatRateBdt: 100,
    currency: 'BDT' as const,
  },
  shippingDestination: { country: 'BD' },
} as const;
```

### 8.3 `packages/env/marketing.ts`

```ts
import { z } from 'zod';

export const clientMarketingEnv = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().regex(/^\d{15,16}$/).optional(),
  NEXT_PUBLIC_GOOGLE_ADS_ID: z.string().regex(/^AW-\d+$/).optional(),
  NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL: z.string().optional(),
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  META_DOMAIN_VERIFICATION: z.string().optional(),
});

export const serverMarketingEnv = z.object({
  META_CAPI_ACCESS_TOKEN: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  META_CATALOG_ID: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_ADS_CONVERSION_ACTION_ID: z.string().optional(),
  GOOGLE_MERCHANT_ID: z.string().optional(),
  R2_FEEDS_BUCKET: z.string(),
  R2_FEEDS_PUBLIC_URL: z.string().url(),
});

export type ClientMarketingEnv = z.infer<typeof clientMarketingEnv>;
export type ServerMarketingEnv = z.infer<typeof serverMarketingEnv>;
```

## 9. Observability

`apps/admin/app/analytics-health/page.tsx` — internal dashboard behind admin auth. Shows, for a selected date range:

| Metric | Source |
|---|---|
| Orders (DB) | `orders` table count |
| GA4 purchases | GA4 Data API |
| Meta browser `Purchase` | Meta Marketing API |
| Meta server `Purchase` | Meta CAPI events received stat |
| Google Ads conversions | Google Ads API |
| Match quality (Meta) | CAPI `event_match_quality` |
| Dedup rate (Meta) | CAPI deduplicated event ratio |
| Outbox dead-letter depth | `SELECT count(*) FROM tracking_outbox WHERE status='failed'` |
| Feed rejection rate (Google) | Merchant Center API `productstatuses.list` |
| Feed rejection rate (Meta) | Commerce Manager API |
| Consent opt-in rate | Client reports `page_view` with/without `ad_storage=granted` |

Drift alerts: if DB order count diverges > 5% from GA4/Meta/Ads for any 24h window, dashboard renders a red banner.

## 10. Phased delivery

Each phase is independently shippable. No phase requires a later phase to function.

### Phase 1 — SEO foundation (week 1)
- `metadataBase` on root layout
- `config/brand.ts` + `config/commerce-policies.ts` with placeholders
- `packages/env/marketing.ts` + wiring in both apps
- `lib/seo/` split factory files (product, collection, blog, bundle, defaults)
- `lib/seo/canonical.ts` query-param allowlist
- `lib/seo/truncate.ts` word-safe truncation
- Update existing `generateMetadata` calls to use new factories + `unstable_cache` with fallback
- `app/robots.ts`
- `app/sitemap-index.xml` + all four sharded sitemaps
- `apps/api` `/products/slugs` cursor endpoint
- `apps/api` `X-Robots-Tag: noindex` middleware for non-HTML

Ship state: every URL has correct metadata, canonicals, absolute OG URLs, and is in a valid sitemap. Immediate ranking + share preview improvements.

### Phase 2 — Structured data + OG images (week 2)
- All JSON-LD builders under `lib/seo/jsonld/`
- Embed JSON-LD on: homepage (Organization + WebSite), PDP (Product + ProductGroup + Breadcrumb), collection (ItemList + CollectionPage + Breadcrumb), blog (Article + Breadcrumb), FAQ-bearing pages (FAQPage conditional), office/contact page (LocalBusiness with office data)
- `app/opengraph-image.tsx` for homepage with module-scope font buffer
- Collection + blog OG images using `ImageResponse` with `force-static` where possible
- PDP OG via `metadata.openGraph.images` from real product photos
- hreflang `en-BD` + `x-default` on root
- Search Console + Meta domain verification meta tags wired via env vars

Ship state: rich results eligible (products show price/availability/stars in SERP if reviews present), shares render correctly on WhatsApp/Facebook/X.

### Phase 3 — Client analytics (week 3)
- `components/analytics/{ga4,meta-pixel,google-ads-tag}.tsx`
- `components/consent/*` (provider, banner, modal)
- `lib/analytics/{events,event-id,utm,consent}.ts`
- `hooks/{use-page-view,use-track-event}.ts`
- Instrument PDP (`view_item`), add-to-cart button, wishlist add, cart drawer open, checkout steps, search overlay, login/signup forms
- Middleware extends to capture click IDs into cookies

Ship state: GA4 + Pixel + Ads tags live (when env vars present), consent banner live, full e-commerce event stream flowing.

### Phase 4 — Server-side conversions (week 4)
- `apps/api/src/tracking/` module: outbox entity + service + worker
- Meta CAPI adapter with hashed PII + event_id dedup
- Google Ads Enhanced Conversions adapter
- Order paid flow hooks into outbox
- `apps/web/app/api/track/route.ts` for low-authority lead events

Ship state: authoritative purchase events hit Meta and Google server-side, dedup against client Pixel, match quality measurable.

### Phase 5 — Product feeds (week 5)
- `apps/api/src/feeds/` module: generators + cron + R2 upload
- Submit to Merchant Center + Meta Commerce Manager (manual, one-time)
- Domain verification for feed hosting

Ship state: Performance Max + Advantage+ Catalog Ads can launch.

### Phase 6 — Polish + 2026 readiness (week 6)
- Customer Match weekly sync job
- `apps/admin/app/analytics-health` reconciliation dashboard
- Migrate Google feed from XML to Merchant API when GCP project + Merchant Center exist
- Blog body MDX migration (optional, defer further if out of scope)

Ship state: retargeting lists warming, measurement observability live, feeds on modern API.

## 11. Test strategy

- **Unit tests:** every JSON-LD builder produces schema.org-valid output via `schema-dts` type guards. `canonical.ts` allowlist stripping covered for each route type. `event-id.ts` determinism verified.
- **Integration tests (NestJS):** outbox write occurs in same tx as order paid; worker retries on 5xx; dead-letters after 8 attempts. CAPI payload shape matches Meta spec. Google Ads upload shape matches Ads API spec.
- **E2E tests (Playwright):**
  - Consent banner appears on first visit, dismisses, persists.
  - PDP metadata contains expected title / canonical / OG URL.
  - Sitemap index resolves; each child sitemap returns valid XML.
  - Purchase flow fires client Pixel with deterministic event_id matching server outbox entry.
- **Manual validation:**
  - Google Rich Results Test on PDP, collection, blog.
  - Facebook Sharing Debugger on homepage, PDP, collection.
  - Meta Pixel Helper browser extension on full purchase flow.
  - Google Tag Assistant on full purchase flow.
  - Meta CAPI Test Events mode with `META_TEST_EVENT_CODE`.
  - Google Ads conversion diagnostics for Enhanced Conversions match rate.
  - Merchant Center + Commerce Manager feed diagnostics.

## 12. Out of scope / documented deferrals

- **sGTM on Cloud Run** — revisit at >1,000 purchases/month or when client-side signal loss exceeds 25% despite CAPI.
- **Privacy Sandbox** — monitor Chrome rollout; BD market runs mostly on Android/Facebook in-app anyway.
- **iOS SKAdNetwork** — not applicable without native app.
- **Multi-locale (Bengali, en-IN)** — architecture ready (`languages` map + hreflang builder) but no content.
- **Blog MDX migration** — defer; Article schema emits with plain text `articleBody` until migration.
- **Server-side GA4 via Measurement Protocol** — not added; NestJS outbox currently dispatches only to Meta CAPI + Google Ads. Extend pattern later if needed.
- **Review UGC ingestion** — `AggregateRating` no-op until review surface exists.

## 13. Risks

| Risk | Mitigation |
|---|---|
| GA4 auto `send_page_view` double-fires with our hook | `send_page_view: false` in `gtag('config')` + test in Tag Assistant |
| Event ID drift between client Pixel and NestJS CAPI | Deterministic formula `sha256(orderId+eventName+ts)`, shared `event-id.util` |
| ISR caches an old canonical URL after product slug change | Purge cache on product update; canonical comes from API field, not slug path |
| Outbox worker backs up during outage | Dead-letter depth dashboard alert + manual replay command |
| R2 public URL ratelimits under Merchant/Meta poll load | Cloudflare cache in front of R2 (default behavior), long `Cache-Control` on feeds |
| Consent banner perceived as broken for no-JS crawlers | Banner is JS-only; crawlers see full content (noindex isn't involved) |
| Description truncation produces awkward cuts | Word-boundary-safe truncation utility with ellipsis |
| `gclid` not captured if user hits a cached HTML page | Middleware runs on edge pre-cache; cookie set regardless of cache state |

---

**Next step:** hand off to `writing-plans` for the phased implementation plan.
