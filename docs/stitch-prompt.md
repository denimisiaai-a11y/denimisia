# DENIMISIA — Complete UI/UX Design System & Page Specifications

## Brand Overview

**Denimisia** is a premium Bangladeshi denim and essentials brand. The aesthetic is editorial, minimal, and cinematic — inspired by wrclo.com (high-end fashion editorial) and genie.pk (regional fashion e-commerce). The brand philosophy is "Made in Bangladesh. Made to Last." — understated luxury with a focus on garment quality and craftsmanship.

**Design Language:** Fashion-forward editorial. NOT generic e-commerce transactional. Think Shopify Fabric meets COS meets A.P.C. — clean, intentional, garment-focused. Every pixel should feel considered and unhurried.

**Currency:** BDT (৳) — Bangladeshi Taka. Format: ৳1,099

**Target Audience:** Fashion-conscious young adults in Bangladesh (18-35), predominantly women, who value quality denim and are willing to pay premium prices (৳799–৳1,099 per piece).

---

## Design Tokens

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| **Ink** | #030302 | Primary text, dark backgrounds, active states, buttons |
| **Paper** | #ffffff | Page background, text on dark surfaces |
| **Muted** | #6b6b6b | Secondary text, descriptions, metadata |
| **Muted BG** | #f5f5f5 | Card backgrounds, product image backgrounds, alternating sections |
| **Border** | #e8e8e8 | Subtle borders, dividers, inactive states |
| **Border Strong** | #030302 | Active borders, selected states |
| **Success** | #1a7f37 | Delivered status, free shipping note |
| **Error** | #cf222e | Error messages, cancelled orders |
| **Warning** | #9a6700 | Low stock alerts, pending status |

**Opacity Usage:** Paper text on dark backgrounds uses opacity tiers — /90 (body), /80 (eyebrow), /70 (column headers), /60 (social icons idle), /40 (footer links idle), /30 (copyright).

### Typography

**Font Family:** Geist Sans (system sans-serif fallback)

| Element | Size | Weight | Tracking | Case | Line Height |
|---------|------|--------|----------|------|-------------|
| Hero headline | clamp(2.25rem–4rem), 4xl→7xl responsive | 600 (semibold) | 0.08em | UPPERCASE | 1.15 |
| Hero eyebrow | 11px | 600 | 0.25em | UPPERCASE | — |
| Hero subtitle | sm→base responsive | 400 (normal) | — | Sentence | relaxed |
| Page title | 2xl→4xl responsive | 500 (medium) | 0.2em | UPPERCASE | 1.15 |
| Section heading | xl→2xl responsive | 500 | 0.1em | UPPERCASE | — |
| Form label | 12px (xs) | 600 | 0.1em–0.15em | UPPERCASE | — |
| Body text | 14px (sm) | 400 | — | Sentence | relaxed (1.65) |
| Product name | 13px | 400 (normal) | — | Sentence | snug |
| Product price | 13px | 500 (medium) | — | — | — |
| Nav links | 12px (xs) | 500 | 0.15em | UPPERCASE | — |
| Announcement bar | 12px (xs) | 300 (light) | 0.2em | UPPERCASE | — |
| Footer column header | 11px | 600 | 0.15em | UPPERCASE | — |
| Footer links | 14px (sm) | 400 | — | Sentence | — |
| Copyright | 11px | 400 | — | Sentence | — |
| Badge/tag | 10px–11px | 600 | 0.05em–0.1em | UPPERCASE | — |
| Pill button | 12.8px (0.8rem) | 600 | 0.05em | UPPERCASE | — |

**Heading Scale (fluid clamp):**
- h1: clamp(2.25rem, 5vw, 4rem)
- h2: clamp(1.75rem, 3.5vw, 2.75rem)
- h3: clamp(1.25rem, 2.5vw, 1.75rem)

### Spacing & Layout

- **Container:** max-width 1440px, centered
- **Container padding:** px-6 (mobile), px-10 (md), px-16 (lg)
- **Section padding:** py-14 to py-20 (varies by section for rhythm)
- **Grid gaps:** gap-x-4 (mobile), gap-x-6 (md), gap-x-8 (lg)
- **Row gaps:** gap-y-8 to gap-y-12

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| xs | 2px | Minimal radius (most elements) |
| sm | 4px | Cards, inputs |
| md | 8px | Larger containers |
| lg | 12px | Modals |
| full | 9999px | Pills, badges, avatar circles |

The overall aesthetic uses MINIMAL radius. Almost everything is near-square. This is intentional — editorial, not friendly/rounded.

### Shadows

Shadows are used sparingly:
- Navbar (scrolled state): shadow-sm
- Carousel arrows: shadow-md
- Cart drawer: shadow-xl

### Animation & Easing

**Easing:** cubic-bezier(0.4, 0, 0.2, 1) — smooth deceleration for all transitions

| Element | Effect | Duration |
|---------|--------|----------|
| Button hover | scale(1.03) | 200ms |
| Product card image hover | scale(1.03) | 500ms |
| Category card image hover | scale(1.05) | 700ms (cinematic) |
| Navbar show/hide | translateY | 300ms |
| Drawer slide | translateX | 300ms |
| Entrance animation (FadeIn) | opacity 0→1, y 24→0 | 600ms |
| Marquee scroll | translateX(-50%) | 30s linear infinite |
| Footer link hover | color transition | 200ms |
| Accordion chevron | rotate 180° | 200ms |

**FadeIn (Framer Motion):** Elements fade in from 24px below with 0.6s duration, triggered once when entering viewport (margin -80px for early trigger). Used on hero content and brand story.

---

## Component Library

### 1. Pill Button

Two variants, both fully rounded (9999px):

**Primary (White fill):**
- Background: paper, text: ink
- Padding: 12px 32px
- Font: 0.8rem, weight 600, uppercase, tracking 0.05em
- Hover: scale(1.03)

**Outline:**
- Background: transparent, border: 1px paper (or ink on light backgrounds), text: paper (or ink)
- Same padding, font, hover

### 2. Product Card

- **Image container:** aspect-[3/4], bg-muted-bg, overflow hidden
- **Image:** object-cover, hover scale 1.03 (500ms), supports hover-swap to second image
- **Below image (mt-4, space-y-1):**
  - Product name: 13px, normal weight, ink
  - Star rating (optional): filled stars (ink) + empty stars (border), 10px, with review count in muted 11px
  - Price: 13px, medium weight, ink. Compare-at price in muted with line-through
  - Color count (optional): 11px, muted, "X Colours"

### 3. Bundle Card

- Same aspect-[3/4] image container as product card
- **Badge overlay at bottom:** bg-ink/90, px-3 py-2.5 (md: px-4 py-3)
- Badge text: 10px (md: 11px), semibold, uppercase, tracking 0.1em, paper color, line-clamp-2
- Product name below: same as product card

### 4. Section Heading

- Reusable `<h2>` component
- text-center, xl (md: 2xl), medium weight, uppercase, tracking 0.1em, ink
- Consistent section title treatment across all homepage sections

### 5. Announcement Bar

- Height: 32px, bg-ink, text-paper
- Text: xs, light weight, uppercase, tracking 0.2em
- Content scrolls horizontally via marquee animation (30s loop)
- Collapses to h-0 when user scrolls down (smooth 300ms transition)

### 6. Status Badge

- Padding: px-2.5 py-1, rounded-sm
- Font: 11px, semibold, uppercase, tracking 0.05em
- Color coding:
  - PENDING/PAYMENT_FAILED: warning bg/10 + warning text
  - CONFIRMED/DELIVERED: success bg/10 + success text
  - PROCESSING/SHIPPED: ink bg/10 + ink text
  - CANCELLED: error bg/10 + error text
  - REFUNDED: muted bg/10 + muted text

### 7. Form Input

- Full width, border: 1px border color, bg: transparent
- Padding: px-4 py-3, font: 14px, ink text
- Focus state: border changes to ink
- Label above: 12px, semibold, uppercase, tracking 0.1em, muted (or ink for section headers)
- Placeholder: muted/60 opacity

### 8. Cart Item (in drawer)

- Image thumbnail: 80w × 96h px, bg-muted-bg
- Name: 14px medium ink (clickable, hover:underline)
- Attributes: 12px muted "Color / Size"
- Quantity controls: bordered inline flex, minus/plus buttons (h-8 w-8), count centered
- Price: 14px medium + remove button (X icon, muted→error on hover)

---

## Page Designs

### Homepage (10 sections, top to bottom)

**Section 1: Hero**
- Full viewport height (100vh), full width
- Background image: editorial flat-lay or model shot, object-cover, priority loaded
- Dark overlay: ink at 40% opacity
- Content centered: eyebrow ("Spring / Summer 2026" in 11px semibold), headline ("Raw Collection" in 4xl→7xl responsive), subtitle (sm→base, 90% opacity, max-w-md), pill CTA button (white variant)
- FadeIn entrance animation on content

**Section 2: Category Cards**
- 3-column editorial grid (1 col on mobile)
- Each card: 40vh mobile / 65vh desktop height, full-width image, object-cover
- Hover: image scales 1.05 over 700ms (cinematic slow zoom)
- Gradient overlay: from-ink/60 at bottom fading to transparent
- Label: positioned bottom-left (bottom-6 left-6 → md: bottom-8 left-8), base→lg size, medium weight, uppercase, tracking 0.15em, paper color
- Cards: "Tops", "Denims", "Jackets"

**Section 3: New Arrivals**
- White background
- Section heading: "NEW ARRIVALS"
- 4-column grid (2 on mobile), product cards with API data
- Padding: py-16 (mobile), py-20 (lg)

**Section 4: Bundle Deals**
- White background
- Section heading: "BUNDLE DEALS"
- 4-column grid (2 on mobile), bundle cards with black badge overlays
- Badge examples: "BUY 2 JEANS + 1 PANJABI • GET 15% OFF", "BUY 1+1 • GET 10% OFF"
- Padding: py-14 (mobile), py-16 (lg) — slightly tighter than New Arrivals for rhythm

**Section 5: Trending**
- Light gray background (bg-muted-bg) — visual separation
- Section heading: "TRENDING"
- Horizontal scrollable carousel (no visible scrollbar)
- Card widths: 40vw mobile → 26vw sm → 19vw md → 16vw lg
- Navigation arrows: hidden on mobile, visible on lg+, h-10 w-10 rounded-full, paper bg, shadow-md, centered vertically
- Product cards with star ratings and review counts
- "View All" pill button (outline variant) centered below, mt-10

**Section 6: Best Sellers**
- White background
- Section heading: "BEST SELLERS"
- 4-column grid (2 on mobile), 4 products displayed
- Padding: py-14 (mobile), py-16 (lg)

**Section 7: Brand Story**
- Full-width cinematic section, 60vh (mobile) / 65vh (desktop)
- Background: editorial/lifestyle image, object-cover
- Dark overlay: ink at 50% opacity
- Content centered: headline ("Made in Bangladesh." in 3xl→6xl responsive, medium weight), body text (sm→base, 90% opacity, max-w-lg), "Our Story →" link (underline, xs, semibold, paper/90 hover:paper)
- FadeIn entrance animation

### Navbar (3-state scroll system)

**State 1 — At top (scrollY < 80px):**
- Transparent background, no shadow
- All text/icons: paper (white) — sits over dark hero
- Announcement bar visible above (32px, ink bg)
- Logo: "DENIMISIA" centered, semibold, uppercase, tracking 0.2em

**State 2 — Scrolling down:**
- Navbar slides up and hides (-translate-y-full)
- Announcement bar collapses to h-0

**State 3 — Scrolling up (past hero):**
- Solid paper (white) background, shadow-sm
- All text/icons: ink (dark)
- Announcement bar stays hidden

**Desktop layout (lg+):**
- Left: Shop / Collection / Series menu triggers
- Center: DENIMISIA logo (absolute centered)
- Right: About link + Search icon + User icon + Cart icon (with badge)

**Mobile layout:**
- Left: Hamburger (2 horizontal lines, h-px w-5, gap-1.5)
- Center: DENIMISIA logo
- Right: Search + Cart icons

**Mega Menu (desktop hover):**
- Full-width dropdown panel, paper bg, shadow
- Content: link columns with section headers (11px semibold uppercase) + link items + featured images (h-280px w-200px, hover:scale-105)
- 150ms hover delay before closing

**Mobile Menu (drawer):**
- Slides from left, w-320px max-w-85vw, paper bg
- Header: "MENU" + close button (X)
- Accordion sections with ChevronDown rotation
- Full-height scrollable content

### Navigation Structure

**Shop:** Women (11 subcategories: Cargo, Culotte, Flare, Wide Leg, Mom, Jegging, Slouchy, Skinny, Straight, Sweatshirt, Jacket) + Men (8 subcategories: Cargo, Slim Fit, Regular Fit, Skinny, Shorts, Jackets, Sweatshirt, Relaxed Fit) + 2 featured images

**Collection:** All Collections, AW'24, SS25, Dropout25, AW'25, Spring'26 (with item counts) + 1 featured image

**Series:** Tops (9 items: All, Shackets, Shirts, Jackets, T-shirts, Tracksuits, Sweaters, Hoodies, Checks with item counts) + Pants (4 items: All, Track Pants, Denims, Trousers) + 2 featured images

**About:** Direct link

### Footer

- Full-width, bg-ink, py-16
- Max-width 1440px content, centered
- **Layer 1:** Social icons (Facebook, Instagram, TikTok) centered, 18px, paper/60 idle → paper on hover, gap-6
- **Layer 2:** 3-column link grid (1 col mobile → 3 cols sm+), max-w-2xl, gap-10
  - Column 1 "Company Info": About Us, Blog/Press, Career, Privacy Policy
  - Column 2 "Help & Support": Contact Us, Size Guide, Outlets
  - Column 3 "Shipping & Delivery": Track Your Order, Exchange & Return
  - Headers: 11px semibold uppercase tracking 0.15em, paper/70
  - Links: 14px, paper/40 idle → paper on hover, space-y-2.5
- **Layer 3:** Copyright "© 2026 - Denimisia Ltd." in 11px paper/30

---

### Product Detail Page

**Layout:** Two-column (stacked on mobile, side-by-side on lg with gap-16)

**Left — Image Gallery:**
- Main image: aspect-[3/4], bg-muted-bg
- Thumbnail strip below: h-20 thumbnails, w-16 each, gap-2, horizontal scroll
- Active thumbnail: 2px ink border; inactive: transparent border

**Right — Product Info:**
- Breadcrumb: xs, muted, ChevronRight separators, hover:text-ink
- Product name: 2xl→3xl, medium weight
- Price: xl, semibold. Compare-at price: muted, line-through
- **Color selector:** label (xs semibold uppercase), flex wrap buttons (px-4 py-2, xs uppercase tracking 0.05em). Selected: bg-ink text-paper border-ink. Unselected: border-border text-ink hover:border-ink
- **Size selector:** Same label style. In-stock: same as color. Out-of-stock: border/50 opacity, text-muted/40, line-through, cursor-not-allowed, disabled
- **Stock warning:** xs text-warning "Only N left in stock" (shows when stock 1-5)
- **Add to Cart button:** Full width, py-4, sm semibold uppercase tracking 0.15em. Enabled: bg-ink text-paper hover:bg-ink/90. Disabled: bg-muted-bg text-muted. Text changes: "Select a Size" / "Out of Stock" / "Add to Cart"
- **Description:** bordered top, pt-6. Label in xs semibold uppercase, body in sm text-muted leading-relaxed
- **Tags:** Flex wrap badges, bg-muted-bg, px-3 py-1, 11px uppercase tracking 0.1em, muted text

---

### Collection Page

- **Header:** Centered, py-12. Title: 3xl→4xl medium uppercase tracking 0.2em. Description (if any): sm muted, max-w-lg. Product count: xs muted.
- **Grid:** 2-col (mobile) → 3-col (md) → 4-col (lg), gap-x-4, gap-y-10
- **Cards:** Standard product cards
- **Empty state:** Centered "No products in this collection yet." in sm muted

---

### Search Page

- **Search input:** Centered max-w-2xl, border-bottom-only (2px ink), py-4, lg font-light. Search icon (20px muted) positioned left. Clear button (X, muted→ink hover) positioned right. Auto-focus.
- **Status text:** sm muted, mt-4. States: "Searching..." / 'No results for "query"' / "N result(s) for 'query'"
- **Results grid:** Same 2→3→4 column grid as collections
- **Empty state:** "Start typing to search products" centered

---

### Login Page

- Centered layout, max-w-sm, min-h-screen
- **Title:** 2xl medium uppercase tracking 0.2em, centered, mb-8
- **Form:** space-y-5
  - Email input (standard form input styling)
  - Password input
  - Submit button: full width, py-3.5, sm semibold uppercase tracking 0.15em, bg-ink text-paper. Loading: "Signing in..."
- **Footer:** mt-8, sm muted, "Don't have an account?" + underlined link to /register

### Register Page

- Same layout as login
- **Title:** "CREATE ACCOUNT"
- **Form:** space-y-5
  - First Name + Last Name: 2-column grid with gap-4
  - Email input
  - Password input (minLength 8, placeholder "At least 8 characters")
  - Submit button: "Create Account" / "Creating account..."
- **Footer:** "Already have an account?" + link to /login

---

### Checkout Page

**Layout:** Two-column on lg (main form + 400px order summary sidebar)

**Left — Shipping Form:**
- Section heading: xs semibold uppercase tracking 0.15em
- Standard form inputs for: Full Name, Street Address, City + State (2-col), Postal Code + Phone (2-col), Discount Code
- Payment method: bordered box with radio indicator (16px circle, 2px ink border, inner 8px filled circle), "Cash on Delivery (COD)"

**Right — Order Summary (sticky on lg):**
- Bordered box (1px border, p-6)
- Heading: xs semibold uppercase tracking 0.15em
- Cart items: thumbnail (w-12 h-16, muted-bg) + name + attributes (xs muted) + price
- Totals: subtotal, shipping (with free shipping note in xs success if applicable), grand total (semibold, bordered top)
- Submit: full width, "Place Order — ৳X,XXX", py-3.5, semibold uppercase

**States:** Loading ("Loading..."), unauthenticated (sign in prompt), empty cart, success (order confirmation with "View Orders" button)

---

### Cart Drawer

- **Slide-in from right:** fixed, full height, max-w-400px, paper bg, shadow-xl
- **Backdrop:** ink/40 (click to close)
- **Header:** "CART (N)" in sm semibold uppercase tracking 0.15em + X close button, border-bottom
- **Items list:** Scrollable, space-y-6 between items
- **Per item:** Thumbnail (w-20 h-24) + info (name with hover:underline, "Color / Size" in xs muted) + quantity controls (bordered ±, h-8 w-8 buttons) + price + remove (X icon, muted→error hover)
- **Footer:** border-top, subtotal (medium uppercase tracking 0.1em + semibold price), "Shipping calculated at checkout" in xs muted, full-width "Checkout" pill button
- **Empty state:** ShoppingBag icon (48px, muted) + "Your cart is empty" + "Continue Shopping" pill outline button

---

### Account Pages

**Shared layout:** Section heading (lg medium uppercase tracking 0.1em, mb-6)

**Profile (/account):**
- Read-only fields in 2-col grid (sm+): First Name, Last Name, Email, Phone
- Label: xs semibold uppercase tracking 0.1em muted
- Value: sm ink, mt-1
- Phone shows "Not set" if empty

**Orders (/account/orders):**
- List with space-y-4
- Per order card: bordered (1px border, p-5, hover:border-ink transition)
  - Order number: sm medium ink "Order #ID"
  - Date: xs muted
  - Status badge + total (sm medium) aligned right
  - Item count: xs muted

**Order Detail (/account/orders/[id]):**
- Order info header + status badge
- Item list with thumbnails
- Shipping address display
- Order totals

**Wishlist (/account/wishlist):**
- 2→3→4 col grid (gap-4)
- Standard product cards (aspect 3/4, muted-bg, hover scale)
- Empty: "Your wishlist is empty." in sm muted

**Addresses (/account/addresses):**
- 2-col grid on sm+, gap-4
- Per card: bordered (1px border, p-5)
  - Default badge (if applicable): inline-block, bg-ink, px-2 py-0.5, 10px semibold uppercase tracking 0.1em, paper text
  - Label/name: sm medium ink
  - Street, City/State/Zip: sm muted
  - Phone: xs muted

---

## Pages That Need Design (Not Yet Built)

These pages are linked in the navigation but have no designs yet. They should follow the established design language:

### Shop Pages
- **/shop/women** — Women's category landing page with subcategory filters
- **/shop/men** — Men's category landing page with subcategory filters
- **/shop/women/[subcategory]** — Filtered product grid (e.g., /shop/women/cargo)
- **/shop/men/[subcategory]** — Filtered product grid

### Series Pages
- **/series/tops** — All tops with subcategory tabs
- **/series/tops/[type]** — Filtered (shackets, shirts, jackets, t-shirts, etc.)
- **/series/pants** — All pants
- **/series/pants/[type]** — Filtered (denims, trousers, track pants)

### Content Pages
- **/about** — Brand story page. Should expand on the "Made in Bangladesh. Made to Last." narrative. Full-width hero image, brand values, manufacturing story, team photos. Editorial feel.
- **/blog** — Blog listing page. Card grid with featured image, title, excerpt, date. Minimal, magazine-style.
- **/blog/[slug]** — Blog post detail. Long-form content with large images, pull quotes, clean typography.
- **/contact** — Contact form + store information. Map, phone, email, social links. Simple, clean.

### Utility Pages
- **/size-guide** — Size chart tables for different product types. Clean table design with clear headers.
- **/outlets** — Store locations with addresses and hours. Cards or map-based.
- **/track-order** — Order tracking input (order number + email) and status timeline.
- **/returns** — Return/exchange policy page with step-by-step instructions.
- **/privacy** — Privacy policy. Long-form legal text with clear headings.

### Account Enhancements (interactive forms needed)
- **Profile edit form** — Edit first name, last name, phone. Same form input styling as checkout.
- **Address add/edit modal or page** — Full address form (label, street, city, state, zip, phone, set as default toggle).
- **Address delete confirmation** — Minimal modal or inline confirmation.
- **Change password form** — Current password + new password + confirm.
- **Wishlist toggle** — Heart icon button on product detail page and product cards. Filled heart = wishlisted, outline heart = not. Animate on toggle.
- **Write review form** — Star rating selector (clickable stars) + title + body textarea + image upload. On product detail page.

---

## Admin Panel (Entirely New — Phase 3)

The admin panel (`apps/admin/`) needs full design from scratch. It should use **shadcn/ui** component library with the same ink/paper/muted color tokens for brand consistency, but can be more functional/dense than the storefront.

### Admin Design Principles
- Dense but readable — more information per viewport than storefront
- Data tables as primary pattern
- Left sidebar navigation
- White/light theme to match brand
- Same Geist Sans font
- shadcn/ui components adapted to Denimisia's ink/paper palette

### Admin Pages

**Dashboard (/dashboard)**
- Revenue cards: Today, This Week, This Month, Total (with trend arrows)
- Charts: Revenue over time (line), Orders by status (bar), Top products (horizontal bar)
- Recent orders table (last 10)
- Low stock alerts list
- Quick stats: Total products, Total customers, Pending orders, Active discounts

**Products (/products)**
- Data table: Image thumbnail, Name, SKU, Price, Stock, Status, Category, Actions
- Search + filter bar (category, status, price range)
- Bulk actions (activate, deactivate, delete)
- "Add Product" button (top-right)

**Product Create/Edit (/products/new, /products/[id])**
- Multi-section form: Basic Info (name, slug, description, tags), Pricing (price, compare-at), Images (drag-drop upload, reorder), Variants (size/color matrix with individual stock/price), Category + Collection assignment
- Preview panel showing product card appearance

**Orders (/orders)**
- Data table: Order #, Customer, Date, Status (badge), Total, Items, Payment, Actions
- Filter by status, date range, payment method
- Click → order detail

**Order Detail (/orders/[id])**
- Order info header with status badge + status change dropdown
- Customer info card
- Items table with thumbnails
- Shipping address
- Status history timeline (vertical timeline with timestamps)
- Payment info
- Actions: Update status, Cancel order, Add note

**Customers (/customers)**
- Data table: Name, Email, Phone, Orders count, Total spent, Joined date, Actions
- Search by name/email
- Click → customer profile

**Customer Detail (/customers/[id])**
- Profile info card
- Order history table
- Address list
- Wishlist items
- Customer lifetime value (CLV)

**Inventory (/inventory)**
- Data table: Product, Variant (size/color), SKU, Current Stock, Status (In Stock/Low/Out), Last Updated
- Low stock filter (red highlight for stock ≤ 5)
- Stock adjustment modal: quantity input + reason select (Restock/Adjustment/Return) + note

**Collections (/collections)**
- Card grid or list: Collection image, name, product count, status (active/inactive), date range
- Drag-drop reorder
- Create/edit modal or page

**Discounts (/discounts)**
- Data table: Code, Type, Value, Usage (used/max), Status, Date Range, Actions
- Create/edit form: code, type (percentage/fixed/free-shipping), value, min order, max uses, date range, applicable products/categories

**Analytics (/analytics)**
- Revenue dashboard: daily/weekly/monthly toggle, line chart
- Top products: horizontal bar chart with product thumbnails
- Order status breakdown: pie/donut chart
- Customer metrics: new vs returning, CLV distribution
- Conversion funnel: visitors → product views → add to cart → checkout → purchase

**Campaign Management (/campaigns)** — Phase 2 module
- Campaign list: Name, Type (Flash Sale/Seasonal/Promo), Status, Date Range, Products count
- Create form: name, type, date range, product selection (search + add), discount per product
- Active campaign banner/indicator

**CMS (/cms)** — Phase 3 module
- Homepage section editor: reorder sections (drag-drop), enable/disable toggle, edit content per section
- Banner management: image upload, link, scheduling (start/end dates), position
- Blog editor: rich text editor, cover image, excerpt, publish/draft toggle

**Settings (/settings)**
- Store info: name, description, contact, social links
- Shipping zones: Bangladesh zones, rates per zone
- Roles & permissions: role list, permission checkboxes per role

**Audit Log (/audit-log)**
- Chronological activity feed: who, what action, when, details
- Filter by user, action type, date range
- Expandable rows showing before/after JSON diff

---

## Responsive Behavior

| Breakpoint | Value | Key Changes |
|------------|-------|-------------|
| Mobile (default) | < 640px | 1-2 col grids, hamburger nav, full-width sections |
| sm | 640px | 2-col product grids, footer columns |
| md | 768px | 3-col product grids, larger text |
| lg | 1024px | Full desktop nav, mega menus, 4-col grids, side-by-side layouts |

**Mobile-specific:** Touch-friendly tap targets, carousel scrolling (no arrow buttons), accordion menus, stacked layouts, full-width inputs.

**Desktop-specific:** Mega menu hovers, carousel arrows, sticky sidebar on checkout, multi-column forms.

---

## Image Guidelines

**Product Photography:** Flat-lay on neutral backgrounds. Clean, minimal staging. Show garment texture and detail. 3:4 portrait aspect ratio.

**Editorial/Category:** Lifestyle model shots or cinematic flat-lays. Full-bleed treatment. Slow hover zoom (700ms) for cinematic feel.

**Hero:** Single hero image (no carousel/slider). Full-screen cover. Dark overlay for text legibility.

**Brand Story:** Cinematic wide shot — manufacturing, craftsmanship, or lifestyle. Full-width with heavy overlay.

**Placeholder backgrounds:** #f5f5f5 (muted-bg) when images are loading or missing. This is the fallback — if product images fail to load, the card renders as a tall gray rectangle with only the product name and price below. Designs should assume all product images load correctly; gray placeholder boxes indicate a data/image issue, not intentional design.

**IMPORTANT — Image availability:** Only 14 images exist locally (5 product shots, 3 category, 4 collection, 1 hero, 1 brand story). All product images from the API database reference subdirectory paths (e.g., `/images/21003/LTN-600x800.jpg`) that do not exist yet. Designs should use the 5 available product images (`product-bella.jpg`, `product-cyra.jpg`, `product-dira.jpg`, `product-lana.jpg`, `product-zoey.jpg`) and cycle/repeat them across product grids rather than showing broken image placeholders.

---

## Critical Layout Rule: No Empty Sections

**Data-driven sections (New Arrivals, Trending, Best Sellers) MUST NOT render when they have zero products.** If a section receives an empty product array, it should return nothing — no padding, no heading, no container. This prevents large white gaps between content sections. Only sections with visible content should occupy vertical space.

Sections that always render (hardcoded content, no data dependency):
- Hero, Category Cards, Bundle Deals, Brand Story — these are safe to always show.

Sections that depend on API data and must hide when empty:
- New Arrivals, Trending, Best Sellers — show ONLY when products > 0.

---

## Interaction Patterns

1. **Hover-swap on product cards:** Second image appears on hover (desktop only)
2. **Cart drawer:** Opens on "Add to Cart" action, slide from right
3. **Mega menu:** Hover trigger with 150ms close delay
4. **Debounced search:** 300ms debounce on keystroke, instant clear
5. **Quantity controls:** ± buttons with min 1 / max 99 clamp
6. **Form validation:** Inline error messages in error color
7. **Loading states:** Button text changes ("Signing in...", "Creating account...", "Placing order...")
8. **Empty states:** Icon + message + CTA button pattern (for pages like cart, wishlist, orders — NOT for homepage sections, which should simply not render)
9. **Variant selection:** Toggle button groups, disabled state for out-of-stock

---

## Social Media

- Facebook: https://facebook.com/denimisia
- Instagram: https://instagram.com/denimisia
- TikTok: https://tiktok.com/@denimisia

---

## Brand Copy Reference

- Announcement: "DENIMISIA™ · SPRING'26 · FREE DELIVERY OVER ৳1,500"
- Hero headline: "Raw Collection"
- Hero eyebrow: "Spring / Summer 2026"
- Hero subtitle: "A study in form, texture, and understated luxury."
- Hero CTA: "Explore the Collection"
- Brand story headline: "Made in Bangladesh."
- Brand story body: "Premium denim crafted with intention. Built to age gracefully with you."
- Brand story link: "Our Story →"
- Metadata: "Premium denim and essentials. Crafted to last."
- Free shipping: "Free shipping on orders over ৳1,500"
