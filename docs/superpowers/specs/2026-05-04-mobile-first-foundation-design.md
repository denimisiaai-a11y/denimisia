# Mobile-First Foundation — Design Spec

**Date:** 2026-05-04
**App:** `apps/web` (Denimisia storefront)
**Status:** Approved design — ready for implementation planning
**Spec relationship:** This is **Spec 1 of 2**. Spec 2 will re-skin the conversion path (homepage → shop → PDP → cart → checkout) using the primitives defined here.

---

## 1. Problem

The Denimisia storefront currently feels like a "desktop layout shrunk down" on phones. The information architecture, interaction patterns, and gestures are inherited from desktop. Users on phones (the majority of e-commerce traffic) get a degraded experience compared to native-mobile commerce apps like Aritzia, SSENSE, or Zara.

The bar this spec sets: at viewport widths `<768px`, the storefront should feel **native-mobile** — sticky CTAs at the thumb zone, bottom sheets for transactions, swipeable carousels, persistent thumb-zone navigation, safe-area-aware chrome, and 60fps interactions on a mid-tier Android (Pixel 4a as the floor).

## 2. Scope

### In scope (this spec)

A foundation layer of reusable mobile primitives plus targeted refactors of three existing surfaces (cart, filter, mobile menu). The primitives are the load-bearing building blocks; Spec 2 consumes them.

### Out of scope (Spec 2 territory)

- PDP gallery upgrade (uses the `Carousel variant="gallery"` primitive defined here, but applied there)
- Checkout flow re-skin
- Product detail page mobile redesign
- Account / orders / blog / static pages mobile redesign

### Breakpoint

"Mobile" for this spec = **`<768px`** (Tailwind `md:` breakpoint). Phones and small tablet portrait. At `md:` and above, behavior remains as it is today.

### Brand positioning

**Hybrid editorial.** The bottom navigation and sticky chrome are minimal, ghost-styled, translucent — utility surfaces that don't fight the editorial brand. Imagery and content remain front and center.

## 3. Architecture

### File layout

```
apps/web/
├── components/
│   └── mobile/                          ← NEW: foundation primitives
│       ├── bottom-bar.tsx
│       ├── sticky-cta.tsx
│       ├── bottom-sheet.tsx
│       ├── carousel.tsx
│       ├── skeleton.tsx
│       └── safe-area.tsx
├── lib/
│   └── mobile/
│       ├── tokens.ts                    ← Typography, touch sizes, breakpoints
│       └── use-media-query.ts           ← <768px detection hook
└── app/
    ├── globals.css                      ← Safe-area CSS vars, prefers-reduced-motion baseline
    └── layout.tsx                       ← Mounts <MobileChrome /> orchestrator
```

### Why this layout

- All new primitives live under `components/mobile/` so they are discoverable as a kit, not scattered through the existing component tree.
- Tokens live in TypeScript so primitives can read them programmatically (e.g., minimum touch size in JS for hit-testing), not just in Tailwind config.
- A single `<MobileChrome />` orchestrator in root `layout.tsx` coordinates `BottomBar`, `StickyCTA` slots, and safe-area padding so they never overlap each other or the iOS home indicator.

### New dependencies

| Package | Size | Purpose |
|---|---|---|
| `vaul` | ~4kb | Bottom sheet physics + gestures |
| `embla-carousel-react` | ~5kb | Rich carousel (PDP gallery only, dynamically imported) |

Total bundle add at root: **~4kb** (embla is route-split). `framer-motion` is already in `package.json` and is used only for sheet enter/exit, not micro-interactions.

## 4. Primitives

### 4.1 `<BottomBar />`

Persistent ghost-styled thumb-zone navigation.

**Behavior**
- Renders on all routes EXCEPT `/checkout/*`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (route list is a single constant in `lib/mobile/tokens.ts`).
- 3 icons: **Shop** (opens mobile menu drawer), **Search** (opens existing search overlay), **Bag** (opens cart sheet). Bag shows item count badge driven by the existing cart store.
- 56px tall. `backdrop-filter: blur(20px)` + 80% white background. 1px hairline top border.
- Respects `safe-area-inset-bottom` so it floats above the iPhone home indicator.
- Active state: 3px dot under the active icon (no full fill). Active means current route matches.
- **Hide on scroll-down, show on scroll-up** behavior, toggleable via prop. Pure CSS transform (`translateY`), GPU-accelerated.

**A11y**
- Each icon has a `aria-label`.
- `role="navigation"` with `aria-label="Primary"`.

### 4.2 `<StickyCTA>{children}</StickyCTA>`

Wrapper that pins its child button(s) to the bottom of the viewport above the BottomBar (or at viewport bottom on routes where BottomBar is hidden).

**Behavior**
- Used on PDP ("Add to bag" full-width) and cart ("Checkout · $X" full-width).
- Translucent backdrop blur behind the button so it stays legible over scrolled content.
- Auto-adds matching `padding-bottom` to its sibling content via a layout effect so nothing is occluded.
- Stacks correctly with BottomBar (CTA sits above bar, both respect safe area).

### 4.3 `<BottomSheet />`

Built on **vaul**. Single primitive that replaces the cart and filter side drawers on mobile.

**API**
```tsx
<BottomSheet
  open={open}
  onOpenChange={setOpen}
  snapPoints={['50%', '90%']}      // optional; defaults to single auto-height snap
  initialSnap={0}
  dismissible                       // drag-down or backdrop-tap to close
  title="Filters"                   // a11y label
  footer={<StickyCTA>...</StickyCTA>} // optional pinned footer inside the sheet
>
  {children}
</BottomSheet>
```

**Behavior**
- Slides up with iOS-native spring physics (vaul handles gesture math).
- Drag handle at top: 4×40px pill, both visual affordance and drag target.
- Backdrop: 60% black with backdrop-blur. Tap to dismiss.
- Body scroll lock while open (prevents background scroll on iOS).
- Bottom padding auto-inset for home indicator.
- Keyboard handling: when an input inside the sheet focuses, sheet auto-snaps to 90% and adjusts for keyboard height via the `visualViewport` API.
- Escape key dismisses; focus trap inside sheet while open.

### 4.4 `<Carousel />`

Two implementations behind one component, chosen by `variant` prop. Default is the cheap one.

**Default: `variant="snap"`**
- Pure CSS `scroll-snap-type: x mandatory` on the track, `scroll-snap-align: start` on each child.
- Native momentum scroll, zero JS, 60fps on every device.
- Used for: homepage product rails, category cards, "you may also like", related products on PDP.
- Optional dot indicators rendered from `IntersectionObserver` (read-only, no scroll hijacking).

**Rich: `variant="gallery"`**
- Loaded via dynamic import only on routes that use it.
- Designed for the PDP image gallery — needs programmatic slide control, dot indicators, fullscreen-on-tap with pinch-zoom, slide-changed callback for analytics.
- Lazy-loads off-screen images via embla's `lazyLoad` plugin.
- **Built in this spec, applied in Spec 2.** No consumer in Spec 1's migration plan uses this variant. It exists in the foundation kit ready for the PDP redesign.

**Shared API**
```tsx
<Carousel variant="snap" gap={12} showDots={false}>
  {items.map(item => <ProductCard key={item.id} {...item} />)}
</Carousel>
```

**Performance defaults applied automatically**
- `touch-action: pan-x` on the track.
- `overscroll-behavior-x: contain` (no accidental browser back gesture).
- `content-visibility: auto` on each slide.
- All images use Next/Image with `sizes="(max-width: 768px) 80vw, 320px"`.

### 4.5 `<Skeleton />`

Async placeholder.

- `<Skeleton className="h-40 w-full" />` renders a shimmer block.
- Shimmer is a CSS gradient + `transform: translateX()` keyframe (GPU-only, no JS).
- Respects `prefers-reduced-motion` → static gray block instead of shimmer.
- Used in: product card placeholders on shop pages, image placeholders on PDP, cart line items during update.

### 4.6 `<SafeArea />`

Utility component for one-off cases not covered by sticky chrome.

- `<SafeArea edge="bottom" />` renders a spacer of `env(safe-area-inset-bottom)`.
- `edge` prop accepts `top | bottom | left | right`.

## 5. Tokens

### Typography scale (`lib/mobile/tokens.ts` + Tailwind `@theme`)

Separate scale from desktop. Tighter, denser, designed for small screens.

| Role | Mobile size / line-height | Desktop size / line-height |
|---|---|---|
| Display (hero) | 36px / 1.05 | 64px / 1.0 |
| H1 (PDP title) | 22px / 1.2 | 32px / 1.15 |
| H2 (section) | 18px / 1.25 | 24px / 1.2 |
| Body | 15px / 1.5 | 16px / 1.55 |
| Small / meta | 13px / 1.45 | 14px / 1.5 |
| Button label | 15px / 1 | 14px / 1 |

Wired via Tailwind v4 `@theme` in `globals.css` so utilities like `text-body` automatically resolve to the right size at the right breakpoint.

### Touch target tokens

```ts
export const TOUCH = {
  min: 44,         // absolute minimum hit area (Apple HIG floor)
  default: 48,     // default for all interactive primitives (Material)
  comfortable: 56, // primary CTAs, bottom bar icons
}
```

Enforced via Tailwind utilities (`min-h-[var(--touch-default)]`) on every interactive primitive shipped in this spec.

### Safe-area CSS variables (`globals.css`)

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --bottom-bar-h: 56px;
  --bottom-bar-total: calc(var(--bottom-bar-h) + var(--safe-bottom));
}
```

Required HTML change: add `viewport-fit=cover` to the viewport meta in `app/layout.tsx`. Without this, `env()` does not populate on iOS.

### Global motion baseline (`globals.css`)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

One rule. Accessibility win across every primitive and every existing component for free.

## 6. Performance contract

Every primitive in this spec MUST adhere to the following rules. These are not aspirations; they are acceptance criteria.

- **Transform + opacity only** for animation. No animating `width` / `height` / `top` / `left` / `margin`.
- **Native CSS scroll-snap** for carousels by default. Reach for JS (embla) only when interaction needs demand it.
- **`touch-action`** declared on every draggable surface (`pan-y` for sheets, `pan-x` for carousels).
- **Passive touch listeners** (`{ passive: true }`) so scroll never blocks.
- **`prefers-reduced-motion` honored** globally via the rule above.
- **Framer Motion only for sheet/drawer enter-exit.** No framer for hover micro-interactions (CSS handles those for free).
- **`content-visibility: auto`** on off-screen product card grids and carousel slides.
- **Next/Image with `sizes`** on every primitive that ships imagery.
- **`will-change` only during active gesture**, removed after.

### Performance budget (measured on a Pixel 4a, throttled 4G)

- Bottom sheet open: first frame **<16ms** (60fps).
- Carousel swipe: maintains **60fps for the entire gesture**.
- BottomBar mount adds **<10kb** to the root JS bundle.
- LCP on homepage: **no regression from baseline**.

## 7. Migration plan

Each step is a separate, atomically-revertable commit.

1. **Add deps + tokens** — install `vaul`, `embla-carousel-react`. Wire `tokens.ts`, Tailwind `@theme` extensions, safe-area CSS vars, viewport-fit meta, prefers-reduced-motion baseline. **No visual change yet.**
2. **Build primitives in isolation** — `BottomSheet`, `BottomBar`, `StickyCTA`, `Carousel`, `Skeleton`, `SafeArea`. Each gets a demo route under `/dev/mobile/*` (gated to non-production) for visual QA on a real device.
3. **Mount global chrome** — add `<MobileChrome>` to root `layout.tsx`. BottomBar appears on browse routes. No existing component touched yet.
4. **Refactor `cart-drawer.tsx` → `cart-sheet.tsx`** — uses `BottomSheet` below `md:`, keeps side drawer at `md:` and above. Smoke test cart flow.
5. **Refactor `mobile-filter-drawer.tsx` → `filter-sheet.tsx`** — uses `BottomSheet` with snap points `['50%', '90%']`. Smoke test shop filtering.
6. **Polish `mobile-menu.tsx`** — accordion categories, 48px tap targets, drag-to-close gesture, search field at top. No primitive change, just upgrades. Stays as side drawer (intentional: navigation hierarchy reads better as a side drawer).
7. **Swap homepage rails to `<Carousel variant="snap">`** — three rails: New Arrivals, Best Sellers, Trending.

PDP gallery, checkout, and other pages are deferred to Spec 2.

## 8. Acceptance criteria

This spec is "done" when ALL are true.

### Functional
- All 6 primitives exist under `components/mobile/` with TypeScript types and prop docs.
- BottomBar visible on all routes except checkout/auth, hidden on those routes.
- Cart and filter open as bottom sheets on mobile, side drawers on desktop, with no regression to existing cart/filter logic.
- Mobile menu has accordion categories and drag-to-close.
- Homepage rails swipe with native scroll-snap.
- All sticky chrome respects iOS safe-area-inset-bottom.

### Performance
- All numbers in §6 met on Pixel 4a / throttled 4G.

### Accessibility
- All primitives keyboard-navigable; modal primitives focus-trapped.
- All tappables ≥44×44.
- `prefers-reduced-motion` honored globally.
- Screen-reader labels on all icon-only buttons.

### Testing
- Each primitive has a Playwright smoke test that mounts it, performs the core gesture (open sheet / swipe carousel / tap bottom-bar icon), and verifies the expected state.
- Visual QA pass on real devices: at minimum one iPhone (Safari) and one Android (Chrome) at `<768px`.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bottom sheet keyboard handling broken on Android Chrome | Use vaul's built-in `visualViewport` handling; manual QA on Pixel during step 2. |
| Backdrop-blur tanks performance on low-end Android | Provide a `--backdrop-blur` CSS variable that resolves to `blur(20px)` by default and `none` when `(update: slow)` media query matches. |
| Existing cart/filter logic breaks during refactor | Cart-sheet and filter-sheet are wrappers around the existing internals — only the chrome changes, not the line-item or filter components. Smoke tests cover the flow end-to-end. |
| BottomBar feels "appy" and dilutes editorial brand | Ghost styling (translucent + blur), 3 icons only, hide-on-scroll behavior, optional per-route disable prop. |
| Vaul or embla incompatible with React 19 / Next 16 | Verify in step 1 before any primitive depends on them. If broken, fall back to framer-motion `Drawer` for sheets and pure CSS scroll-snap everywhere for carousels. |

## 10. Open questions

None. All scoping decisions were resolved during brainstorming.
