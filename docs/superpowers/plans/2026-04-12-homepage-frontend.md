# Denimisia Homepage Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Denimisia e-commerce homepage — a fashion-forward, wrclo.com-inspired landing page with editorial imagery, mega-menu navigation, and dynamic product sections.

**Architecture:** Next.js 16 App Router with server components by default, client components only where interactivity is required (navbar scroll, carousels, tabs). All styling via Tailwind CSS v4 with existing design tokens in globals.css. Framer Motion for entrance animations. Data fetched from NestJS API via `lib/api.ts`.

**Tech Stack:** Next.js 16.2, React 19.2, Tailwind CSS 4.2, Framer Motion 12.38, Zustand 5 (cart), TanStack Query 5, Lucide React (icons), Geist font.

**Design Decisions (locked in previous session):**
- Hero: Full-screen (100vh), centered text, pill CTA, single image (no slider)
- Navbar: Transparent on hero, hides on scroll down, solid white on scroll up, transparent again at top
- Mega menus: Full-width dropdowns for Shop (Women/Men), Collection (seasonal), Series (Tops/Pants)
- Category cards: 3 editorial columns (Tops / Denims / Jackets)
- New Arrivals: 4x2 product grid, flat-lay photos, light gray bg
- Bundle Deals: 4x2 grid, black badges with white text
- Trending: Women/Men tabs, horizontal carousel, model shots, star ratings, "View all" pill button
- Best Sellers: Category tabs, 4 products per tab, editorial lifestyle photos
- Brand Story: Full-width cinematic image, "Made in Bangladesh. Made to Last."
- Footer: Minimal dark, social icons centered, horizontal links, copyright

**Existing assets in `public/images/`:**
- `hero-1.jpg` — hero background
- `category-men.jpg`, `category-women.jpg`, `category-wide-leg.jpg` — category cards
- `collection-best-sellers.jpg`, `collection-cargo-men.jpg`, `collection-shop-men.jpg`, `collection-shop-women.jpg` — collection images
- `product-bella.jpg`, `product-cyra.jpg`, `product-dira.jpg`, `product-lana.jpg`, `product-zoey.jpg` — product photos
- `our-message.jpg` — brand story background

**Existing utilities:**
- `lib/utils.ts` — `cn()` (class merge), `formatPrice()` (BDT ৳), `slugify()`
- `lib/api.ts` — `apiFetch()`, `getProducts()`, `getProductBySlug()`, `getFeaturedProducts()`, `getCategories()`, `getCategoryBySlug()`, `getCollections()`
- `stores/cart.ts` — Zustand cart with `addItem()`, `removeItem()`, `openCart()`, etc.

**Design tokens (globals.css @theme):**
- Colors: `--color-ink: #030302`, `--color-paper: #ffffff`, `--color-muted: #6b6b6b`, `--color-muted-bg: #f5f5f5`, `--color-border: #e8e8e8`
- Radius: `--radius-xs: 2px`, `--radius-full: 9999px` (pill buttons)
- Easing: `--ease-default: cubic-bezier(0.4, 0, 0.2, 1)`
- Container: max-width 1440px with responsive padding

---

## File Structure

```
apps/web/
├── app/
│   ├── globals.css              (modify — add marquee animation keyframes)
│   ├── layout.tsx               (modify — wrap children with Navbar + Footer)
│   └── page.tsx                 (modify — compose all homepage sections)
├── components/
│   ├── layout/
│   │   ├── announcement-bar.tsx (create — scrolling marquee strip)
│   │   ├── navbar.tsx           (create — main nav with scroll behavior)
│   │   ├── mega-menu.tsx        (create — full-width dropdown panels)
│   │   ├── mobile-menu.tsx      (create — hamburger drawer + accordions)
│   │   └── footer.tsx           (create — dark footer with 3 link columns)
│   ├── home/
│   │   ├── hero-section.tsx     (create — full-screen hero with CTA)
│   │   ├── category-cards.tsx   (create — 3-column editorial cards)
│   │   ├── new-arrivals.tsx     (create — 4x2 product grid)
│   │   ├── bundle-deals.tsx     (create — 4x2 bundle grid with badges)
│   │   ├── trending-section.tsx (create — tabbed carousel with ratings)
│   │   ├── best-sellers.tsx     (create — tabbed product display)
│   │   └── brand-story.tsx      (create — full-width cinematic about)
│   └── ui/
│       ├── product-card.tsx     (create — reusable product card)
│       ├── bundle-card.tsx      (create — bundle deal card with badge)
│       └── section-heading.tsx  (create — consistent section titles)
├── hooks/
│   └── use-scroll-direction.ts  (create — scroll up/down/top detection)
└── lib/
    └── constants.ts             (create — nav menu data, social links)
```

---

## Phase 0: Foundation

### Task 1: Add marquee keyframes and pill button utility to globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

The announcement bar needs an infinite horizontal scroll animation. We also need a pill button utility.

- [ ] **Step 1: Add keyframes and utilities to globals.css**

Add the following at the end of `globals.css`:

```css
/* Marquee animation for announcement bar */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-marquee {
  animation: marquee 30s linear infinite;
}

/* Pill button base */
.btn-pill {
  display: inline-block;
  padding: 12px 32px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: transform 0.2s var(--ease-default), opacity 0.2s var(--ease-default);
  cursor: pointer;
}

.btn-pill:hover {
  transform: scale(1.03);
}

.btn-pill-white {
  background-color: var(--color-paper);
  color: var(--color-ink);
}

.btn-pill-outline {
  background-color: transparent;
  border: 1px solid var(--color-paper);
  color: var(--color-paper);
}
```

- [ ] **Step 2: Verify dev server starts**

Run: `cd apps/web && pnpm dev`
Open: `http://localhost:3000`
Expected: Page loads without CSS errors. No visual change yet.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat: add marquee keyframes and pill button utilities to globals.css"
```

---

### Task 2: Create scroll direction hook

**Files:**
- Create: `apps/web/hooks/use-scroll-direction.ts`

This hook powers the 3-state navbar behavior:
- State 1 (top): `scrollY < threshold` → navbar transparent, announcement bar visible
- State 2 (scrolling down): `scrollDir === 'down'` → navbar hidden
- State 3 (scrolling up): `scrollDir === 'up'` → navbar solid white

- [ ] **Step 1: Create the hook**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

interface ScrollState {
  direction: 'up' | 'down' | 'none';
  isAtTop: boolean;
  scrollY: number;
}

export function useScrollDirection(threshold = 80): ScrollState {
  const [state, setState] = useState<ScrollState>({
    direction: 'none',
    isAtTop: true,
    scrollY: 0,
  });
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateScroll = () => {
      const currentY = window.scrollY;
      const isAtTop = currentY < threshold;
      const direction =
        currentY > lastScrollY.current ? 'down' : currentY < lastScrollY.current ? 'up' : state.direction;

      setState({ direction, isAtTop, scrollY: currentY });
      lastScrollY.current = currentY;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScroll);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, state.direction]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-scroll-direction.ts
git commit -m "feat: add useScrollDirection hook for 3-state navbar behavior"
```

---

### Task 3: Create navigation data constants

**Files:**
- Create: `apps/web/lib/constants.ts`

Centralizes all menu structure, social links, and footer data. This avoids hardcoding navigation trees inside components.

- [ ] **Step 1: Create constants file**

```typescript
export interface NavSubItem {
  label: string;
  href: string;
  count?: number;
}

export interface NavMenuSection {
  title: string;
  items: NavSubItem[];
}

export interface NavMenuItem {
  label: string;
  href?: string;
  sections?: NavMenuSection[];
  featuredImages?: { src: string; alt: string; href: string }[];
}

export const NAV_ITEMS: NavMenuItem[] = [
  {
    label: 'Shop',
    sections: [
      {
        title: 'Women',
        items: [
          { label: 'Cargo', href: '/shop/women/cargo' },
          { label: 'Culotte', href: '/shop/women/culotte' },
          { label: 'Flare', href: '/shop/women/flare' },
          { label: 'Wide Leg', href: '/shop/women/wide-leg' },
          { label: 'Mom', href: '/shop/women/mom' },
          { label: 'Jegging', href: '/shop/women/jegging' },
          { label: 'Slouchy', href: '/shop/women/slouchy' },
          { label: 'Skinny', href: '/shop/women/skinny' },
          { label: 'Straight', href: '/shop/women/straight' },
          { label: 'Sweatshirt', href: '/shop/women/sweatshirt' },
          { label: 'Jacket', href: '/shop/women/jacket' },
        ],
      },
      {
        title: 'Men',
        items: [
          { label: 'Cargo', href: '/shop/men/cargo' },
          { label: 'Slim Fit', href: '/shop/men/slim-fit' },
          { label: 'Regular Fit', href: '/shop/men/regular-fit' },
          { label: 'Skinny', href: '/shop/men/skinny' },
          { label: 'Shorts', href: '/shop/men/shorts' },
          { label: 'Jackets', href: '/shop/men/jackets' },
          { label: 'Sweatshirt', href: '/shop/men/sweatshirt' },
          { label: 'Relaxed Fit', href: '/shop/men/relaxed-fit' },
        ],
      },
    ],
    featuredImages: [
      { src: '/images/collection-shop-women.jpg', alt: 'Women collection', href: '/shop/women' },
      { src: '/images/collection-shop-men.jpg', alt: 'Men collection', href: '/shop/men' },
    ],
  },
  {
    label: 'Collection',
    sections: [
      {
        title: 'All Collections',
        items: [
          { label: 'All Collections', href: '/collections' },
          { label: "AW'24", href: '/collections/aw24', count: 6 },
          { label: 'SS25', href: '/collections/ss25', count: 13 },
          { label: 'Dropout25', href: '/collections/dropout25', count: 20 },
          { label: "AW'25", href: '/collections/aw25', count: 37 },
          { label: "Spring'26", href: '/collections/spring26' },
        ],
      },
    ],
    featuredImages: [
      { src: '/images/collection-cargo-men.jpg', alt: 'Latest collection', href: '/collections/spring26' },
    ],
  },
  {
    label: 'Series',
    sections: [
      {
        title: 'Tops',
        items: [
          { label: 'All', href: '/series/tops', count: 91 },
          { label: 'Shackets', href: '/series/tops/shackets', count: 7 },
          { label: 'Shirts', href: '/series/tops/shirts', count: 26 },
          { label: 'Jackets', href: '/series/tops/jackets', count: 6 },
          { label: 'T-shirts', href: '/series/tops/t-shirts', count: 37 },
          { label: 'Tracksuits', href: '/series/tops/tracksuits', count: 1 },
          { label: 'Sweaters', href: '/series/tops/sweaters', count: 11 },
          { label: 'Hoodies', href: '/series/tops/hoodies', count: 4 },
          { label: 'Checks', href: '/series/tops/checks', count: 12 },
        ],
      },
      {
        title: 'Pants',
        items: [
          { label: 'All', href: '/series/pants', count: 32 },
          { label: 'Track Pants', href: '/series/pants/track-pants', count: 1 },
          { label: 'Denims', href: '/series/pants/denims', count: 29 },
          { label: 'Trousers', href: '/series/pants/trousers' },
        ],
      },
    ],
    featuredImages: [
      { src: '/images/collection-best-sellers.jpg', alt: 'Best sellers', href: '/series/tops' },
      { src: '/images/category-wide-leg.jpg', alt: 'Wide leg pants', href: '/series/pants' },
    ],
  },
  {
    label: 'About',
    href: '/about',
  },
];

export const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://facebook.com/denimisia', icon: 'facebook' as const },
  { label: 'Instagram', href: 'https://instagram.com/denimisia', icon: 'instagram' as const },
  { label: 'TikTok', href: 'https://tiktok.com/@denimisia', icon: 'music' as const },
];

export const FOOTER_COLUMNS = [
  {
    title: 'Company Info',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog/Press', href: '/blog' },
      { label: 'Career', href: '/career' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  {
    title: 'Help & Support',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Size Guide', href: '/size-guide' },
      { label: 'Outlets', href: '/outlets' },
    ],
  },
  {
    title: 'Shipping & Delivery',
    links: [
      { label: 'Track Your Order', href: '/track-order' },
      { label: 'Exchange & Return', href: '/returns' },
    ],
  },
];

export const ANNOUNCEMENT_TEXT =
  "DENIMISIA\u2122 \u00b7 SPRING'26 \u00b7 FREE DELIVERY OVER \u09F31,500 \u00b7 DENIMISIA\u2122 \u00b7 SPRING'26 \u00b7 FREE DELIVERY OVER \u09F31,500";

export const BESTSELLER_TABS = ['Wide Leg', 'Baggy', 'Cargo', 'Jackets'];

export const CATEGORY_CARDS = [
  { label: 'Tops', href: '/series/tops', image: '/images/category-women.jpg' },
  { label: 'Denims', href: '/series/pants/denims', image: '/images/category-men.jpg' },
  { label: 'Jackets', href: '/series/tops/jackets', image: '/images/category-wide-leg.jpg' },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/constants.ts
git commit -m "feat: add navigation data and homepage constants"
```

---

### Task 4: Create section heading component

**Files:**
- Create: `apps/web/components/ui/section-heading.tsx`

Consistent uppercase centered headings used across homepage sections.

- [ ] **Step 1: Create the component**

```tsx
interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className = '' }: SectionHeadingProps) {
  return (
    <h2
      className={`text-center text-2xl font-medium uppercase tracking-[0.15em] text-ink md:text-3xl ${className}`}
    >
      {children}
    </h2>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui/section-heading.tsx
git commit -m "feat: add SectionHeading reusable component"
```

---

## Phase 1: Layout Shell

### Task 5: Announcement Bar

**Files:**
- Create: `apps/web/components/layout/announcement-bar.tsx`

Black strip at the very top with infinitely scrolling text. Only visible when user is at the top of the page. The parent navbar controls visibility.

- [ ] **Step 1: Create the component**

```tsx
import { ANNOUNCEMENT_TEXT } from '@/lib/constants';

interface AnnouncementBarProps {
  visible: boolean;
}

export function AnnouncementBar({ visible }: AnnouncementBarProps) {
  return (
    <div
      className={`overflow-hidden bg-ink text-paper transition-all duration-300 ${
        visible ? 'h-8 opacity-100' : 'h-0 opacity-0'
      }`}
    >
      <div className="animate-marquee flex h-full w-max items-center gap-0 whitespace-nowrap">
        <span className="px-8 text-xs font-light uppercase tracking-[0.2em]">
          {ANNOUNCEMENT_TEXT}
        </span>
        <span className="px-8 text-xs font-light uppercase tracking-[0.2em]">
          {ANNOUNCEMENT_TEXT}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/announcement-bar.tsx
git commit -m "feat: add AnnouncementBar with infinite marquee scroll"
```

---

### Task 6: Mega Menu

**Files:**
- Create: `apps/web/components/layout/mega-menu.tsx`

Full-width dropdown panel that appears on hover. Contains sections (columns of links) + featured images on the right.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { NavMenuSection } from '@/lib/constants';

interface MegaMenuProps {
  sections: NavMenuSection[];
  featuredImages?: { src: string; alt: string; href: string }[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function MegaMenu({ sections, featuredImages, onMouseEnter, onMouseLeave }: MegaMenuProps) {
  return (
    <div
      className="absolute left-0 top-full w-screen bg-paper shadow-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mx-auto flex max-w-[1440px] gap-12 px-12 py-10">
        {/* Link sections */}
        <div className="flex flex-1 gap-12">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
                    >
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className="text-xs text-muted/60">{item.count}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Featured images */}
        {featuredImages && featuredImages.length > 0 && (
          <div className="flex gap-4">
            {featuredImages.map((img) => (
              <Link key={img.href} href={img.href} className="group relative block">
                <div className="relative h-[280px] w-[200px] overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="200px"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/mega-menu.tsx
git commit -m "feat: add MegaMenu full-width dropdown component"
```

---

### Task 7: Navbar (desktop, with scroll behavior)

**Files:**
- Create: `apps/web/components/layout/navbar.tsx`

The main navigation bar with:
- Announcement bar on top (visible only at page top)
- Logo centered, nav links split: Shop/Collection/Series left, About right
- Search/Profile/Cart icons far right
- 3-state scroll behavior: transparent at top → hidden on scroll down → solid white on scroll up
- Mega menus on hover

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, User, ShoppingBag } from 'lucide-react';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { AnnouncementBar } from './announcement-bar';
import { MegaMenu } from './mega-menu';
import { MobileMenu } from './mobile-menu';
import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/stores/cart';

export function Navbar() {
  const { direction, isAtTop } = useScrollDirection(80);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = useCartStore((s) => s.count());
  const openCart = useCartStore((s) => s.openCart);

  const handleMenuEnter = useCallback((label: string) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setActiveMenu(label);
  }, []);

  const handleMenuLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveMenu(null), 150);
  }, []);

  // 3-state visibility
  const isHidden = !isAtTop && direction === 'down' && !activeMenu;
  const isSolid = !isAtTop;

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-50 transition-transform duration-300',
          isHidden && '-translate-y-full'
        )}
      >
        {/* Announcement bar — only at top */}
        <AnnouncementBar visible={isAtTop} />

        {/* Main nav */}
        <nav
          className={cn(
            'relative transition-colors duration-300',
            isSolid ? 'bg-paper shadow-sm' : 'bg-transparent'
          )}
        >
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 lg:px-12">
            {/* Left nav links (desktop) */}
            <div className="hidden items-center gap-8 lg:flex">
              {NAV_ITEMS.filter((item) => item.label !== 'About').map((item) => (
                <div
                  key={item.label}
                  onMouseEnter={() => item.sections && handleMenuEnter(item.label)}
                  onMouseLeave={handleMenuLeave}
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(
                        'text-xs font-medium uppercase tracking-[0.15em] transition-colors',
                        isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      className={cn(
                        'text-xs font-medium uppercase tracking-[0.15em] transition-colors',
                        isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70',
                        activeMenu === item.label && (isSolid ? 'text-ink' : 'text-paper')
                      )}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Hamburger (mobile) */}
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <div className="space-y-1.5">
                <span className={cn('block h-px w-5', isSolid ? 'bg-ink' : 'bg-paper')} />
                <span className={cn('block h-px w-5', isSolid ? 'bg-ink' : 'bg-paper')} />
              </div>
            </button>

            {/* Center logo */}
            <Link
              href="/"
              className={cn(
                'absolute left-1/2 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.2em] transition-colors',
                isSolid ? 'text-ink' : 'text-paper'
              )}
            >
              DENIMISIA
            </Link>

            {/* Right side: About + icons */}
            <div className="flex items-center gap-6">
              {/* About link (desktop) */}
              <Link
                href="/about"
                className={cn(
                  'hidden text-xs font-medium uppercase tracking-[0.15em] transition-colors lg:block',
                  isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                )}
              >
                About
              </Link>

              {/* Icons */}
              <div className="flex items-center gap-4">
                <button
                  aria-label="Search"
                  className={cn(
                    'transition-colors',
                    isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                  )}
                >
                  <Search size={18} strokeWidth={1.5} />
                </button>
                <Link
                  href="/account"
                  className={cn(
                    'hidden transition-colors sm:block',
                    isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                  )}
                >
                  <User size={18} strokeWidth={1.5} />
                </Link>
                <button
                  onClick={openCart}
                  aria-label="Cart"
                  className={cn(
                    'relative transition-colors',
                    isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                  )}
                >
                  <ShoppingBag size={18} strokeWidth={1.5} />
                  {count > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
                      {count}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mega menus (desktop) */}
          {NAV_ITEMS.map(
            (item) =>
              item.sections &&
              activeMenu === item.label && (
                <MegaMenu
                  key={item.label}
                  sections={item.sections}
                  featuredImages={item.featuredImages}
                  onMouseEnter={() => handleMenuEnter(item.label)}
                  onMouseLeave={handleMenuLeave}
                />
              )
          )}
        </nav>
      </header>

      {/* Mobile menu */}
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/navbar.tsx
git commit -m "feat: add Navbar with 3-state scroll behavior and mega menus"
```

---

### Task 8: Mobile Menu

**Files:**
- Create: `apps/web/components/layout/mobile-menu.tsx`

Full-screen drawer that slides in from the left on mobile. Contains accordion sections for Shop, Collection, Series, and a direct About link.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ChevronDown } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (label: string) => {
    setExpanded((prev) => (prev === label ? null : label));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-ink/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-[320px] max-w-[85vw] bg-paper transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Menu</span>
          <button onClick={onClose} aria-label="Close menu">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav items */}
        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          {NAV_ITEMS.map((item) =>
            item.href && !item.sections ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="block border-b border-border/50 py-4 text-sm font-medium uppercase tracking-[0.1em] text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <div key={item.label} className="border-b border-border/50">
                <button
                  onClick={() => toggle(item.label)}
                  className="flex w-full items-center justify-between py-4 text-sm font-medium uppercase tracking-[0.1em] text-ink"
                >
                  {item.label}
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    className={cn(
                      'transition-transform',
                      expanded === item.label && 'rotate-180'
                    )}
                  />
                </button>
                {expanded === item.label && item.sections && (
                  <div className="pb-4 pl-4">
                    {item.sections.map((section) => (
                      <div key={section.title} className="mb-4">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
                          {section.title}
                        </h4>
                        <ul className="space-y-2">
                          {section.items.map((sub) => (
                            <li key={sub.href}>
                              <Link
                                href={sub.href}
                                onClick={onClose}
                                className="flex items-center gap-2 text-sm text-ink/80 hover:text-ink"
                              >
                                {sub.label}
                                {sub.count !== undefined && (
                                  <span className="text-[11px] text-muted">{sub.count}</span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/mobile-menu.tsx
git commit -m "feat: add MobileMenu drawer with accordion navigation"
```

---

### Task 9: Footer

**Files:**
- Create: `apps/web/components/layout/footer.tsx`

Dark footer with wrclo aesthetic + structured content:
Layer 1: Social icons centered (Facebook, Instagram, TikTok)
Layer 2: 3 link columns centered (Company Info / Help & Support / Shipping & Delivery)
Layer 3: Copyright line (very dim)

- [ ] **Step 1: Create the component**

```tsx
import Link from 'next/link';
import { Facebook, Instagram, Music } from 'lucide-react';
import { SOCIAL_LINKS, FOOTER_COLUMNS } from '@/lib/constants';

const ICON_MAP = {
  facebook: Facebook,
  instagram: Instagram,
  music: Music, // TikTok — lucide uses Music icon
} as const;

export function Footer() {
  return (
    <footer className="bg-ink px-6 py-16 text-paper">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12">
        {/* Social icons */}
        <div className="flex items-center gap-6">
          {SOCIAL_LINKS.map((link) => {
            const Icon = ICON_MAP[link.icon];
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="text-paper/60 transition-colors hover:text-paper"
              >
                <Icon size={18} strokeWidth={1.5} />
              </a>
            );
          })}
        </div>

        {/* 3 link columns */}
        <div className="grid w-full max-w-2xl grid-cols-1 gap-10 text-center sm:grid-cols-3 sm:text-left">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-paper/70">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-paper/40 transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-paper/30">
          &copy; {new Date().getFullYear()} - Denimisia Ltd.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/footer.tsx
git commit -m "feat: add dark Footer with social icons and 3-column link layout"
```

---

### Task 10: Update layout.tsx

**Files:**
- Modify: `apps/web/app/layout.tsx`

Wrap all pages with Navbar + Footer. The Navbar is a client component (scroll behavior), so it imports cleanly into the server layout.

- [ ] **Step 1: Update layout.tsx**

Replace the entire body content:

```tsx
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Denimisia',
    template: '%s — Denimisia',
  },
  description: 'Premium denim and essentials. Crafted to last.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify layout renders**

Run: `pnpm --filter web dev`
Open: `http://localhost:3000`
Expected: Page shows transparent navbar over content, scrolling marquee at top, dark footer at bottom. Placeholder page content still visible in between.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: integrate Navbar and Footer into root layout"
```

---

## Phase 2: Homepage Sections

### Task 11: Hero Section

**Files:**
- Create: `apps/web/components/home/hero-section.tsx`

Full-screen (100vh) hero with `hero-1.jpg` as background, dark overlay, centered text, pill CTA button.

- [ ] **Step 1: Create the component**

```tsx
import Image from 'next/image';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative flex h-screen w-full items-center justify-center">
      {/* Background image */}
      <Image
        src="/images/hero-1.jpg"
        alt="Denimisia Spring 2026 Collection"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-ink/30" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center text-paper">
        <h1 className="text-4xl font-light uppercase tracking-[0.3em] sm:text-5xl md:text-6xl">
          RAW COLLECTION &apos;26
        </h1>
        <p className="max-w-md text-sm font-light leading-relaxed opacity-90 sm:text-base">
          A study in form, texture, and understated luxury.
        </p>
        <Link href="/collections/spring26" className="btn-pill btn-pill-white mt-2">
          Explore the Collection
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/home/hero-section.tsx
git commit -m "feat: add full-screen HeroSection with centered text and pill CTA"
```

---

### Task 12: Category Cards

**Files:**
- Create: `apps/web/components/home/category-cards.tsx`

3 editorial images side-by-side (Tops / Denims / Jackets). Tall cards (~70-80vh), text overlay at bottom-left, no gap between them.

- [ ] **Step 1: Create the component**

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { CATEGORY_CARDS } from '@/lib/constants';

export function CategoryCards() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3">
      {CATEGORY_CARDS.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group relative h-[60vh] overflow-hidden md:h-[75vh]"
        >
          <Image
            src={card.image}
            alt={card.label}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
          {/* Label */}
          <span className="absolute bottom-8 left-8 text-lg font-medium uppercase tracking-[0.2em] text-paper">
            {card.label}
          </span>
        </Link>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/home/category-cards.tsx
git commit -m "feat: add 3-column CategoryCards with editorial images"
```

---

### Task 13: Product Card (shared UI component)

**Files:**
- Create: `apps/web/components/ui/product-card.tsx`

Reusable across New Arrivals and other product grids. Shows product image on light gray background, name, price, optional colour count. Image swaps on hover if a second image is provided.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
  rating?: number;
  reviewCount?: number;
}

export function ProductCard({
  name,
  slug,
  price,
  image,
  hoverImage,
  colourCount,
  rating,
  reviewCount,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const displayImage = isHovered && hoverImage ? hoverImage : image;

  return (
    <Link
      href={`/products/${slug}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted-bg">
        <Image
          src={displayImage}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium text-ink">{name}</h3>

        {/* Rating (optional — used in Trending section) */}
        {rating !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-xs ${i < Math.round(rating) ? 'text-ink' : 'text-border'}`}
                >
                  &#9733;
                </span>
              ))}
            </div>
            {reviewCount !== undefined && (
              <span className="text-xs text-muted">({reviewCount})</span>
            )}
          </div>
        )}

        <p className="text-sm text-ink">{formatPrice(price)}</p>

        {colourCount !== undefined && colourCount > 0 && (
          <p className="text-xs text-muted">{colourCount} Colours</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui/product-card.tsx
git commit -m "feat: add reusable ProductCard with hover image swap and ratings"
```

---

### Task 14: New Arrivals Section

**Files:**
- Create: `apps/web/components/home/new-arrivals.tsx`

"NEW ARRIVALS" heading + 4x2 product grid (8 products). Uses ProductCard. Data comes from API or placeholder for now.

- [ ] **Step 1: Create the component**

```tsx
import { SectionHeading } from '@/components/ui/section-heading';
import { ProductCard } from '@/components/ui/product-card';

// Placeholder data until API integration
const PLACEHOLDER_PRODUCTS = [
  { name: 'Bella Structured Barrel', slug: 'bella-structured-barrel', price: 1099, image: '/images/product-bella.jpg', colourCount: 3 },
  { name: 'Cyra Wide Leg', slug: 'cyra-wide-leg', price: 899, image: '/images/product-cyra.jpg', colourCount: 5 },
  { name: 'Dira Double Belt', slug: 'dira-double-belt', price: 999, image: '/images/product-dira.jpg', colourCount: 2 },
  { name: 'Lana Relaxed Fit', slug: 'lana-relaxed-fit', price: 1099, image: '/images/product-lana.jpg', colourCount: 4 },
  { name: 'Zoey Cargo Jean', slug: 'zoey-cargo-jean', price: 1199, image: '/images/product-zoey.jpg', colourCount: 3 },
  { name: 'Mira Straight Leg', slug: 'mira-straight-leg', price: 799, image: '/images/product-bella.jpg', colourCount: 2 },
  { name: 'Noor Slim Fit', slug: 'noor-slim-fit', price: 899, image: '/images/product-cyra.jpg', colourCount: 6 },
  { name: 'Raya Bootcut', slug: 'raya-bootcut', price: 999, image: '/images/product-dira.jpg', colourCount: 3 },
];

export function NewArrivals() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-12">
      <SectionHeading className="mb-12">New Arrivals</SectionHeading>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {PLACEHOLDER_PRODUCTS.map((product) => (
          <ProductCard
            key={product.slug}
            name={product.name}
            slug={product.slug}
            price={product.price}
            image={product.image}
            colourCount={product.colourCount}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/home/new-arrivals.tsx
git commit -m "feat: add NewArrivals 4x2 product grid section"
```

---

### Task 15: Bundle Card + Bundle Deals Section

**Files:**
- Create: `apps/web/components/ui/bundle-card.tsx`
- Create: `apps/web/components/home/bundle-deals.tsx`

Bundle cards have a product flat-lay image with a black badge overlay showing the deal. 4x2 grid.

- [ ] **Step 1: Create BundleCard component**

```tsx
import Image from 'next/image';
import Link from 'next/link';

interface BundleCardProps {
  name: string;
  slug: string;
  image: string;
  badgeText: string;
}

export function BundleCard({ name, slug, image, badgeText }: BundleCardProps) {
  return (
    <Link href={`/bundles/${slug}`} className="group block">
      {/* Image + badge */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted-bg">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {/* Black badge */}
        <div className="absolute bottom-0 left-0 right-0 bg-ink/90 px-4 py-3">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.1em] text-paper">
            {badgeText}
          </p>
        </div>
      </div>

      {/* Name */}
      <h3 className="mt-3 text-sm font-medium text-ink">{name}</h3>
    </Link>
  );
}
```

- [ ] **Step 2: Create BundleDeals section**

```tsx
import { SectionHeading } from '@/components/ui/section-heading';
import { BundleCard } from '@/components/ui/bundle-card';

const PLACEHOLDER_BUNDLES = [
  { name: 'Tradition Meets Denim Bundle', slug: 'tradition-denim', image: '/images/product-bella.jpg', badgeText: 'BUY 2 JEANS + 1 PANJABI \u2022 GET 15% OFF' },
  { name: 'Heritage Style Bundle', slug: 'heritage-style', image: '/images/product-cyra.jpg', badgeText: 'BUY 1+1 \u2022 GET 10% OFF' },
  { name: 'Double Denim Combo', slug: 'double-denim', image: '/images/product-dira.jpg', badgeText: 'BUY 3 \u2022 GET 15% OFF' },
  { name: 'Weekend Essentials Pack', slug: 'weekend-essentials', image: '/images/product-lana.jpg', badgeText: 'BUY 2 \u2022 GET 10% OFF' },
  { name: 'Street Style Bundle', slug: 'street-style', image: '/images/product-zoey.jpg', badgeText: 'BUY 2 TOPS + 1 JEAN \u2022 GET 15% OFF' },
  { name: 'Campus Combo', slug: 'campus-combo', image: '/images/product-bella.jpg', badgeText: 'BUY 2 \u2022 GET FREE SHIPPING' },
  { name: 'Workwear Essentials', slug: 'workwear-essentials', image: '/images/product-cyra.jpg', badgeText: 'BUY 3 \u2022 GET 20% OFF' },
  { name: 'Date Night Bundle', slug: 'date-night', image: '/images/product-dira.jpg', badgeText: 'BUY 1+1 \u2022 GET 10% OFF' },
];

export function BundleDeals() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-12">
      <SectionHeading className="mb-12">Bundle Deals</SectionHeading>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {PLACEHOLDER_BUNDLES.map((bundle) => (
          <BundleCard
            key={bundle.slug}
            name={bundle.name}
            slug={bundle.slug}
            image={bundle.image}
            badgeText={bundle.badgeText}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/bundle-card.tsx apps/web/components/home/bundle-deals.tsx
git commit -m "feat: add BundleCard component and BundleDeals 4x2 grid section"
```

---

### Task 16: Trending Section (carousel + gender tabs)

**Files:**
- Create: `apps/web/components/home/trending-section.tsx`

"TRENDING" heading, Women/Men tab toggle, horizontal carousel showing 5 products at a time with scroll arrows. Uses model shots, star ratings. "View all" pill button at bottom.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionHeading } from '@/components/ui/section-heading';
import { ProductCard } from '@/components/ui/product-card';
import { cn } from '@/lib/utils';

const PLACEHOLDER_TRENDING = {
  Women: [
    { name: 'Bella Structured Barrel', slug: 'bella-structured-barrel', price: 1099, image: '/images/product-bella.jpg', rating: 4.5, reviewCount: 7 },
    { name: 'Dira Double Belt Wide Leg', slug: 'dira-double-belt', price: 999, image: '/images/product-dira.jpg', rating: 5, reviewCount: 12 },
    { name: 'Lana Relaxed Fit', slug: 'lana-relaxed-fit', price: 1099, image: '/images/product-lana.jpg', rating: 4, reviewCount: 5 },
    { name: 'Zoey Cargo Jean', slug: 'zoey-cargo-jean', price: 1199, image: '/images/product-zoey.jpg', rating: 4.5, reviewCount: 9 },
    { name: 'Cyra Wide Leg', slug: 'cyra-wide-leg', price: 899, image: '/images/product-cyra.jpg', rating: 5, reviewCount: 3 },
    { name: 'Mira Straight Leg', slug: 'mira-straight-leg', price: 799, image: '/images/product-bella.jpg', rating: 4, reviewCount: 8 },
    { name: 'Noor Slim Fit', slug: 'noor-slim-fit', price: 899, image: '/images/product-dira.jpg', rating: 3.5, reviewCount: 4 },
  ],
  Men: [
    { name: 'Atlas Cargo Fit', slug: 'atlas-cargo-fit', price: 1099, image: '/images/product-lana.jpg', rating: 4.5, reviewCount: 11 },
    { name: 'Raven Slim Stretch', slug: 'raven-slim-stretch', price: 899, image: '/images/product-zoey.jpg', rating: 5, reviewCount: 6 },
    { name: 'Storm Regular Jean', slug: 'storm-regular-jean', price: 999, image: '/images/product-cyra.jpg', rating: 4, reviewCount: 14 },
    { name: 'Blaze Skinny Fit', slug: 'blaze-skinny-fit', price: 799, image: '/images/product-bella.jpg', rating: 4.5, reviewCount: 8 },
    { name: 'Echo Relaxed Short', slug: 'echo-relaxed-short', price: 699, image: '/images/product-dira.jpg', rating: 4, reviewCount: 5 },
    { name: 'Nova Jacket Denim', slug: 'nova-jacket-denim', price: 1499, image: '/images/product-lana.jpg', rating: 5, reviewCount: 2 },
    { name: 'Titan Sweatshirt', slug: 'titan-sweatshirt', price: 1199, image: '/images/product-zoey.jpg', rating: 4, reviewCount: 7 },
  ],
};

type Tab = 'Women' | 'Men';

export function TrendingSection() {
  const [activeTab, setActiveTab] = useState<Tab>('Women');
  const scrollRef = useRef<HTMLDivElement>(null);

  const products = PLACEHOLDER_TRENDING[activeTab];

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth ?? 280;
    const distance = cardWidth + 16; // card width + gap
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="py-20">
      <SectionHeading className="mb-6">Trending</SectionHeading>

      {/* Tabs */}
      <div className="mb-10 flex items-center justify-center gap-6">
        {(['Women', 'Men'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'text-sm uppercase tracking-[0.1em] transition-colors',
              activeTab === tab ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Carousel wrapper */}
      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-12">
        {/* Left arrow */}
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          className="absolute -left-0 top-1/3 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-paper shadow-md transition-transform hover:scale-110 lg:left-2 lg:flex"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth"
        >
          {products.map((product) => (
            <div key={product.slug} className="w-[45vw] flex-shrink-0 sm:w-[30vw] md:w-[22vw] lg:w-[18vw]">
              <ProductCard
                name={product.name}
                slug={product.slug}
                price={product.price}
                image={product.image}
                rating={product.rating}
                reviewCount={product.reviewCount}
              />
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          className="absolute -right-0 top-1/3 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-paper shadow-md transition-transform hover:scale-110 lg:right-2 lg:flex"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* View all button */}
      <div className="mt-12 flex justify-center">
        <a href="/trending" className="btn-pill btn-pill-outline !border-ink !text-ink hover:!bg-ink hover:!text-paper">
          View all
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add scrollbar-hide utility to globals.css**

Add at the end of globals.css:

```css
/* Hide scrollbar but allow scroll */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/home/trending-section.tsx apps/web/app/globals.css
git commit -m "feat: add TrendingSection with gender tabs, carousel, and ratings"
```

---

### Task 17: Best Sellers Section

**Files:**
- Create: `apps/web/components/home/best-sellers.tsx`

"BEST SELLERS" heading (left-aligned per the reference), category tabs below, 4 products per tab. Editorial/lifestyle photos. No "View all" button. Clicking a tab swaps the products.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/ui/product-card';
import { BESTSELLER_TABS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const PLACEHOLDER_BESTSELLERS: Record<string, Array<{
  name: string;
  slug: string;
  price: number;
  image: string;
}>> = {
  'Wide Leg': [
    { name: 'Bella Wide Barrel', slug: 'bella-wide-barrel', price: 1099, image: '/images/product-bella.jpg' },
    { name: 'Dira Double Belt', slug: 'dira-double-belt', price: 999, image: '/images/product-dira.jpg' },
    { name: 'Lana Wide Relaxed', slug: 'lana-wide-relaxed', price: 1099, image: '/images/product-lana.jpg' },
    { name: 'Cyra Palazzo', slug: 'cyra-palazzo', price: 899, image: '/images/product-cyra.jpg' },
  ],
  Baggy: [
    { name: 'Storm Baggy Jean', slug: 'storm-baggy-jean', price: 999, image: '/images/product-zoey.jpg' },
    { name: 'Raven Loose Fit', slug: 'raven-loose-fit', price: 899, image: '/images/product-bella.jpg' },
    { name: 'Atlas Oversized', slug: 'atlas-oversized', price: 1199, image: '/images/product-lana.jpg' },
    { name: 'Echo Drop Crotch', slug: 'echo-drop-crotch', price: 799, image: '/images/product-dira.jpg' },
  ],
  Cargo: [
    { name: 'Zoey Cargo Jean', slug: 'zoey-cargo-jean', price: 1199, image: '/images/product-zoey.jpg' },
    { name: 'Blaze Cargo Pant', slug: 'blaze-cargo-pant', price: 1099, image: '/images/product-cyra.jpg' },
    { name: 'Nova Utility Cargo', slug: 'nova-utility-cargo', price: 1299, image: '/images/product-bella.jpg' },
    { name: 'Titan Tactical', slug: 'titan-tactical', price: 999, image: '/images/product-lana.jpg' },
  ],
  Jackets: [
    { name: 'Denim Trucker Jacket', slug: 'denim-trucker', price: 1499, image: '/images/product-dira.jpg' },
    { name: 'Oversized Shacket', slug: 'oversized-shacket', price: 1299, image: '/images/product-zoey.jpg' },
    { name: 'Cropped Denim Jacket', slug: 'cropped-denim', price: 1199, image: '/images/product-cyra.jpg' },
    { name: 'Washed Bomber', slug: 'washed-bomber', price: 1399, image: '/images/product-bella.jpg' },
  ],
};

export function BestSellers() {
  const [activeTab, setActiveTab] = useState(BESTSELLER_TABS[0]);

  const products = PLACEHOLDER_BESTSELLERS[activeTab] ?? [];

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-12">
      <h2 className="text-2xl font-medium uppercase tracking-[0.15em] text-ink md:text-3xl">
        Best Sellers
      </h2>

      {/* Tabs */}
      <div className="mb-10 mt-6 flex items-center gap-6">
        {BESTSELLER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'text-sm uppercase tracking-[0.1em] transition-colors',
              activeTab === tab ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            name={product.name}
            slug={product.slug}
            price={product.price}
            image={product.image}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/home/best-sellers.tsx
git commit -m "feat: add BestSellers section with category tabs"
```

---

### Task 18: Brand Story Section

**Files:**
- Create: `apps/web/components/home/brand-story.tsx`

Full-width cinematic image (~65vh), dark overlay, centered white text: "Made in Bangladesh. Made to Last." + subtitle + "Our Story" link.

- [ ] **Step 1: Create the component**

```tsx
import Image from 'next/image';
import Link from 'next/link';

export function BrandStory() {
  return (
    <section className="relative flex h-[65vh] w-full items-center justify-center">
      {/* Background */}
      <Image
        src="/images/our-message.jpg"
        alt="Denimisia brand story"
        fill
        className="object-cover"
        sizes="100vw"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-ink/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center text-paper">
        <h2 className="text-3xl font-light uppercase tracking-[0.2em] sm:text-4xl md:text-5xl">
          Made in Bangladesh. Made to Last.
        </h2>
        <p className="max-w-lg text-sm font-light leading-relaxed opacity-85 sm:text-base">
          Premium denim crafted with intention. Built to age gracefully with you.
        </p>
        <Link
          href="/about"
          className="mt-2 text-xs font-medium uppercase tracking-[0.15em] text-paper/80 underline underline-offset-4 transition-colors hover:text-paper"
        >
          Our Story &rarr;
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/home/brand-story.tsx
git commit -m "feat: add BrandStory full-width cinematic about section"
```

---

### Task 19: Compose Homepage

**Files:**
- Modify: `apps/web/app/page.tsx`

Assemble all homepage sections in the correct order.

- [ ] **Step 1: Replace page.tsx content**

```tsx
import { HeroSection } from '@/components/home/hero-section';
import { CategoryCards } from '@/components/home/category-cards';
import { NewArrivals } from '@/components/home/new-arrivals';
import { BundleDeals } from '@/components/home/bundle-deals';
import { TrendingSection } from '@/components/home/trending-section';
import { BestSellers } from '@/components/home/best-sellers';
import { BrandStory } from '@/components/home/brand-story';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CategoryCards />
      <NewArrivals />
      <BundleDeals />
      <TrendingSection />
      <BestSellers />
      <BrandStory />
    </>
  );
}
```

- [ ] **Step 2: Verify full homepage in browser**

Run: `pnpm --filter web dev`
Open: `http://localhost:3000`

Verify each section top to bottom:
1. Announcement bar scrolls text
2. Navbar transparent with white text over hero
3. Hero is full-screen with centered text and pill CTA
4. Scroll down → navbar hides. Scroll up → navbar reappears solid white
5. 3 category cards fill width with editorial images
6. "NEW ARRIVALS" heading + 4x2 product grid
7. "BUNDLE DEALS" heading + 4x2 bundle grid with black badges
8. "TRENDING" heading + Women/Men tabs + horizontal carousel + "View all" pill
9. "BEST SELLERS" left-aligned heading + category tabs + 4 products
10. Brand story full-width image with "Made in Bangladesh. Made to Last."
11. Dark footer with social icons, links, copyright
12. On mobile (resize to 375px): hamburger menu, 2-column grids, stacked category cards

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: compose full homepage with all sections"
```

---

## Phase 3: Polish & Animations

### Task 20: Add Framer Motion entrance animations

**Files:**
- Create: `apps/web/components/ui/fade-in.tsx`
- Modify: `apps/web/components/home/hero-section.tsx` (wrap content)
- Modify: `apps/web/components/home/new-arrivals.tsx` (animate cards)
- Modify: `apps/web/components/home/brand-story.tsx` (animate text)

Add subtle fade-in-up animations as sections enter the viewport.

- [ ] **Step 1: Create FadeIn wrapper component**

```tsx
'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wrap hero content with FadeIn**

In `hero-section.tsx`, import and wrap the `<div className="relative z-10 ...">`:

```tsx
import { FadeIn } from '@/components/ui/fade-in';

// Inside the component, wrap the content div:
<FadeIn>
  <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center text-paper">
    {/* ... existing content ... */}
  </div>
</FadeIn>
```

- [ ] **Step 3: Wrap brand story content with FadeIn**

Same pattern in `brand-story.tsx`:

```tsx
import { FadeIn } from '@/components/ui/fade-in';

// Wrap the content div:
<FadeIn>
  <div className="relative z-10 flex flex-col items-center gap-5 ...">
    {/* ... existing content ... */}
  </div>
</FadeIn>
```

- [ ] **Step 4: Verify animations in browser**

Open `http://localhost:3000` and scroll through the page.
Expected: Hero text fades in on load. Brand story text fades in when scrolled into view. Animations play once (not on every scroll).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/fade-in.tsx apps/web/components/home/hero-section.tsx apps/web/components/home/brand-story.tsx
git commit -m "feat: add FadeIn component and entrance animations to hero and brand story"
```

---

### Task 21: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
pnpm --filter web check-types
```

Expected: No type errors.

- [ ] **Step 2: Run ESLint**

```bash
pnpm --filter web lint
```

Expected: No warnings (configured with `--max-warnings 0`).

- [ ] **Step 3: Run production build**

```bash
pnpm --filter web build
```

Expected: Build succeeds. All pages generate without errors.

- [ ] **Step 4: Fix any errors found**

If type/lint/build errors occur, fix them before proceeding. Common issues:
- Missing `'use client'` directive on components using hooks
- Image imports needing exact paths
- Unused imports

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from homepage implementation"
```

---

## Summary

| Phase | Tasks | Components Created |
|-------|-------|--------------------|
| **0: Foundation** | Tasks 1-4 | globals.css updates, useScrollDirection hook, constants.ts, SectionHeading |
| **1: Layout Shell** | Tasks 5-10 | AnnouncementBar, MegaMenu, Navbar, MobileMenu, Footer, layout.tsx update |
| **2: Homepage Sections** | Tasks 11-19 | HeroSection, CategoryCards, ProductCard, NewArrivals, BundleCard, BundleDeals, TrendingSection, BestSellers, BrandStory, page.tsx |
| **3: Polish** | Tasks 20-21 | FadeIn animation wrapper, build verification |

**Total: 21 tasks, 18 new files, 3 modified files.**

All product data uses placeholders — these will be replaced with API calls (`getProducts()`, `getFeaturedProducts()`) when the API is running. The structure is ready for that swap (just replace the constant arrays with async data fetching in server components).
