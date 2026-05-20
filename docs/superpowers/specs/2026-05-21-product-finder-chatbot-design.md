# Product Finder Chat — Design Spec

**Date:** 2026-05-21
**Status:** Approved for planning
**Constraint:** No LLM, no AI in product surface. Rule-based parser only.

## 1. Goal

Give Denimisia customers a conversational way to find products without using an LLM. The widget should feel like a chat, accept free-text input, recognize a small set of intents, return clickable product cards inline, and help customers pick the right size based on body measurements.

## 2. Non-Goals

- LLM-backed parsing, paraphrasing, or copy generation.
- Open-domain Q&A (shipping, returns, account questions).
- Persistent conversation memory beyond 24 hours per browser.
- Multilingual support in v1.

## 3. Surface & UX

A persistent chat bubble bottom-right on every storefront page except `/checkout`. Tap opens a slide-up panel on mobile and a side panel on desktop. The panel contains a scrollable conversation log, a free-text input at the bottom, and a row of context-aware suggestion chips above the input.

Opening message is plain: *"Looking for something? Tell me what you want, or tap a category."* No bot avatar, no greeting persona, no AI vocabulary.

## 4. Intents

The parser recognizes three intents in this order:

### 4.1 Find products (default)

Free-text input like *"black baggy pants in 30"*. Parser tokenizes, lowercases, strips punctuation, then matches each token against four dictionaries built from the live catalog plus an admin-editable synonym table:

- Categories (Product.type and synonyms: `trousers` → `pants`, `tee` → `t-shirt`)
- Colors (distinct `Variant.color` plus synonyms: `dark blue` → `indigo`)
- Sizes (distinct `Variant.size`: `26`, `28`, `S`, `M`, `L`)
- Fits and other ProductTag values (`baggy`, `slim`, `straight`, `cropped`, etc.)

Fuzzy match uses Levenshtein distance ≤ 1 to absorb typos. Recognized slots become DB filters. Missing slots become follow-up chips. Contradictory slots (`slim baggy`) trigger a clarifying reply.

Reply echoes the parsed slots, shows up to 6 product cards, and footers with chips:
> *"Got it: black · baggy · size 30 · pants. Found 5 matches:"*

Results are ordered by match score (count of slots matched), then by `Product.createdAt desc` as tiebreaker, then in-stock first. Cards link to the product page. A "See all matches →" chip deep-links to `/shop` with filters applied.

### 4.2 What's new

Triggers: `new`, `new arrivals`, `latest`, `recent`, `what's new`. Returns the 6 most recent in-stock products by `Product.createdAt`. Reuses the existing `/new-arrivals` data source.

### 4.3 Help me find my size

Triggers: `size`, `fit me`, `my size`, `measurements`, `body`, `what size am I`, plus the "Help me pick" CTA from the Size Chart modal. Launches the body-size intake flow described in §6.

### 4.4 Fallthrough

Unrecognized input replies: *"I can help find products. For other questions, see contact."* The text is logged to `BotUnrecognizedQuery` for admin review.

## 5. Product Taxonomy

Every product has a Type (required, single-select) plus a type-conditional set of attribute tags.

### 5.1 Types

`PANTS`, `SHIRTS`, `JACKETS`. (Denimisia v1 catalog does not include shorts, skirts, or dresses. New types added later require migration + admin form updates.)

### 5.2 Universal attributes (all types)

- **Season** (multi, required): `Summer`, `Winter`, `Spring/Fall`, `All-season`
- **Occasion** (multi, optional): `Casual`, `Smart casual`, `Formal`, `Workwear`, `Party`
- **Material** (multi, required): `Cotton`, `Denim`, `Linen`, `Leather`, `Wool`, `Polyester`, `Blend`, `Stretch`
- **Pattern** (single, optional): `Solid`, `Striped`, `Checked`, `Printed`, `Graphic`, `Distressed`

### 5.3 Pants

- **Silhouette** (multi, required): `Skinny`, `Slim`, `Straight`, `Relaxed`, `Baggy`, `Wide-leg`, `Bootcut`, `Flared`
- **Rise** (single, required): `Low`, `Mid`, `High`
- **Length** (single, optional): `Full`, `Cropped`, `Ankle`
- **Wash** (single, denim only): `Raw`, `Dark`, `Mid`, `Light`, `Black`, `Distressed`, `Acid`

### 5.4 Shirts

- **Silhouette** (multi, required): `Slim`, `Fitted`, `Regular`, `Relaxed`, `Baggy`, `Oversized`, `Cropped`
- **Sleeve** (single, required): `Sleeveless`, `Short`, `3/4`, `Long`
- **Neckline** (single, required): `Crew`, `V-neck`, `Polo`, `Button-up`, `Henley`, `Mock-neck`
- **Length** (single, optional): `Regular`, `Cropped`, `Tunic`

### 5.5 Jackets

- **Silhouette** (multi, required): `Cropped`, `Fitted`, `Regular`, `Oversized`
- **Length** (single, required): `Cropped`, `Hip-length`, `Mid-length`, `Long`
- **Closure** (single, required): `Zip`, `Button`, `Snap`, `Open/drape`
- **Warmth** (single, required): `Light`, `Medium`, `Heavy`

## 6. Size Charts & Body-Size Flow

### 6.1 Dimensions per type

| Type | Dimensions |
|---|---|
| Pants | Waist, Hip, Inseam, Thigh |
| Shirts | Chest, Shoulder, Length, Sleeve |
| Jackets | Chest, Shoulder, Length, Sleeve |

### 6.2 Storage

`ProductSizeChart` rows store both body measurements (the customer's body) and garment measurements (the actual product), per variant size, per dimension. Stored as `Float` in inches with half-inch precision (e.g. `32.5`). UI offers an in/cm toggle for display and entry.

### 6.3 "Find your size" modal

A button on every product detail page opens a modal showing the size chart for that product. Body and garment columns side by side. A "Help me pick →" CTA opens the chat bubble directly into the body-size intake flow. If the chart is missing, the modal links to the static `/size-guide` page as fallback.

### 6.4 Body-size intake flow (type-aware)

Bot asks only the dimensions relevant to the product type being shopped:

| Type | Bot asks |
|---|---|
| Pants | Waist, Hip, Inseam, Fit preference (slim/regular/baggy) |
| Shirts | Chest, Shoulder, Sleeve length preference, Fit preference (fitted/regular/oversized) |
| Jackets | Chest, Shoulder, Fit preference (fitted/regular/oversized) |

If type is not yet known, the bot asks *"What are you shopping for?"* first. One question per message. Numeric input with in/cm toggle. Skip allowed per question. Thigh and other secondary dimensions are stored in the size chart but not asked during intake — most customers do not know them and the algorithm degrades gracefully without them.

### 6.5 Recommendation algorithm

For each variant of the chosen type with a complete size chart and in-stock units:

1. Compute fit score = sum of `|body_value − bodyValueIn|` across answered dimensions.
2. Apply fit-preference penalty: `slim` adds `+0.5` per dimension when `bodyValueIn > body`, `baggy` adds `+0.5` per dimension when `bodyValueIn < body`, `regular` is neutral.
3. Pick the variant size with the lowest score. If the next-best size is within `1.0` of the winner, return both and let the customer choose by fit preference.
4. Surface 6 product cards in the chosen size.

### 6.6 Fit profile storage

- **Guest:** `localStorage` key `fitProfile`, JSON of `{ type → measurements }`.
- **Logged in:** new `Customer.fitProfile` JSON column. Persisted on intake completion. Prompts to update if older than 6 months.
- **Returning customer:** bot offers *"Last time you were size 30 in pants — still good?"* with Yes / Update Measurements chips.

## 7. Data Model (Prisma)

### 7.1 Product enum

```prisma
enum ProductType {
  PANTS
  SHIRTS
  JACKETS
}

model Product {
  // existing fields...
  type ProductType
  @@index([type])
}
```

### 7.2 ProductTag (flat attribute table)

```prisma
enum TagDimension {
  silhouette
  rise
  length
  wash
  sleeve
  neckline
  closure
  warmth
  season
  occasion
  material
  pattern
}

model ProductTag {
  id        String       @id @default(cuid())
  productId String
  dimension TagDimension
  value     String
  product   Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@unique([productId, dimension, value])
  @@index([dimension, value])
}
```

Rationale: one flat table beats six normalized join tables because new dimensions can be added without schema migrations, the parser hits one query path, and indexes on `(dimension, value)` keep lookups fast. Type safety is enforced at the application layer via DTO validators.

### 7.3 ProductSizeChart

```prisma
model ProductSizeChart {
  id              String  @id @default(cuid())
  productId       String
  sizeKey         String   // e.g. "30", "M"
  dimension       String   // e.g. "waist", "chest"
  bodyValueIn     Float    // inches, half-inch precision (e.g. 32.5)
  garmentValueIn  Float    // inches, half-inch precision
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@unique([productId, sizeKey, dimension])
}
```

### 7.4 Customer fit profile

```prisma
model Customer {
  // existing fields...
  fitProfile Json?  // { pants: {waist,hip,inseam,fitPref,updatedAt}, ... }
}
```

### 7.5 Bot synonym dictionary

```prisma
model BotSynonym {
  id        String   @id @default(cuid())
  dimension String   // "category" | "color" | "size" | TagDimension
  canonical String   // the value used in DB
  aliases   String[] // alternative spellings or words
  updatedAt DateTime @updatedAt
  @@unique([dimension, canonical])
}
```

### 7.6 Unrecognized queries log

```prisma
model BotUnrecognizedQuery {
  id        String   @id @default(cuid())
  text      String
  sessionId String
  gender    String?
  createdAt DateTime @default(now())
  @@index([createdAt])
}
```

## 8. API Endpoints

All under `/api/v1/bot/*` (NestJS controllers).

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/bot/message` | `{ text, context }` | `{ message, products?, chips?, nextContext }` |
| POST | `/bot/recommend-size` | `{ type, measurements, fitPref }` | `{ recommendedSize, alternativeSize?, products[] }` |
| GET | `/bot/synonyms` | — | Active synonym dictionary, cached 5 min |
| GET | `/products/:id/size-chart` | — | `{ dimensions[], rows: { sizeKey, dimension, bodyValueIn, garmentValueIn }[] }` |
| POST | `/customers/me/fit-profile` | `{ type, measurements, fitPref }` | Updated `Customer.fitProfile` |

Server is stateless per request. Conversation state lives on the client and is sent in the `context` blob with every `/bot/message` call.

### 8.1 BotContext shape

```ts
type BotContext = {
  sessionId: string;
  gender?: 'M' | 'F' | null;
  flow?: {
    name: 'sizing';
    step: 'type' | 'waist' | 'hip' | 'inseam' | 'chest' | 'shoulder' | 'sleeve' | 'fitPref';
    type: ProductType;
    collected: Record<string, number | string>;
  };
};
```

## 9. Frontend (apps/web)

- `<ChatWidget />` mounted in `app/layout.tsx`. Hidden when `pathname === '/checkout'`.
- `<ChatPanel />` slide-up on mobile, side panel on desktop.
- `<ChatMessage />` renders bot and customer messages plus inline product cards (reuses existing `<ProductCard />`).
- `<SizeChartModal />` on product detail page, opens from "Find your size" button.
- `useChatStore` (zustand) holds conversation history, current `BotContext`, and fit profile. Persisted to `localStorage` with 24h TTL.

## 10. Admin (apps/admin)

### 10.1 New Product form

- Type dropdown at top. Selecting a Type reveals the conditional attribute sections from §5.
- Required attributes enforced both client-side and server-side (class-validator DTOs).
- Size chart editor below variants: rows = variant sizes (pulled from variants already defined), columns = dimensions (pulled from Type), with body and garment value cells.

### 10.2 Fit Data Dashboard

- Widget on the admin home: "X products missing fit attributes" and "Y products missing size charts" with click-through.
- Backfill table view: filterable list of products with missing data, inline edit for tags and charts.
- Products with missing data remain visible to customers via standard browse, with a "fit unknown" badge inside the bot (no size recommendation shown).

### 10.3 Synonym editor

- CRUD over `BotSynonym` rows.
- Cached server-side dictionary refreshes within 5 min of edit (event-bus invalidation preferred over polling).

### 10.4 Unrecognized queries log

- Table view of `BotUnrecognizedQuery` rows.
- Inline "Add as synonym" action that opens a prefilled form to map the text to an existing canonical value.

## 11. Edge Cases & Quality Rules

| Case | Behavior |
|---|---|
| Stock-aware results | Bot never returns sold-out variants. If all sizes of a candidate product are sold out, that product is dropped from the result list. (Notify-when-back is out of scope for v1.) |
| Contradictory slots | `slim baggy` triggers *"Did you mean Slim or Baggy?"* |
| Typo beyond fuzzy range | *"Did you mean `baggy`?"* with confirm chip. |
| Missing fit data | Product surfaces in search results but the bot does not claim to know the fit. |
| Multi-step flow abandon | Customer closes panel mid-sizing flow. State persisted in localStorage; on reopen, bot offers *"Pick up where you left off?"* |
| Gender awareness | Pulled from the page customer was on when opening the bot. Otherwise asked once per session. |
| Off-topic input | Fallthrough reply per §4.4. |
| Cross-sell | After recommending pants, append chip *"Style with a shirt?"* |
| In-chat actions | Product cards in chat have Add-to-Cart and Wishlist buttons. |
| Repeat sizing intake | Returning logged-in customer is asked *"Still size 30?"* rather than re-running full intake. |

## 12. Testing Strategy

- **Unit:** parser (typo absorption, synonym match, contradiction detection), size-recommendation algorithm with fixture body measurements, attribute validators per Type.
- **Integration:** `POST /bot/message` happy paths, sizing flow state transitions, size-chart CRUD, synonym cache invalidation.
- **E2E (Playwright):** typed query returns matching product cards; sizing flow returns a recommendation; fit profile persists for logged-in customer across sessions; bubble hidden on `/checkout`.
- **Backfill safety:** products without tags or charts must not throw in bot queries.

## 13. Performance & Constraints

- All parsing in-process Node, no external calls. Target p95 latency on `/bot/message` ≤ 200ms.
- Synonym dictionary cached in-memory, invalidated on admin edit.
- Composite indexes: `Product(type)`, `ProductTag(dimension, value)`, `ProductSizeChart(productId, sizeKey, dimension)`.
- Bundle impact: chat widget code split, lazy-loaded on first interaction so the bubble itself adds <10 KB to initial JS.

## 14. Open Items for the Implementation Plan

- Confirm existing `/shop` categories align with the proposed `ProductType` enum or need a one-time mapping migration.
- Confirm shape of existing `Customer` model before adding `fitProfile` JSON column.
- Decide whether `Variant.color` is already canonicalized or needs a one-time normalization (e.g. "Black" vs "BLACK" vs "black").
- Pick the synonym-cache invalidation mechanism (event-bus vs TTL).
- Decide whether to render the chat bubble on the product detail page above or below the "Add to cart" CTA on mobile.
