'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditModeUrlOnly } from '@/hooks/use-iframe-edit-mode';
import { Search, User, ShoppingBag, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { AnnouncementBar } from './announcement-bar';
import { MegaMenu } from './mega-menu';
import { MobileMenu } from './mobile-menu';
import { NAV_ITEMS, type NavMenuItem } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { useMobileChrome } from '@/stores/mobile-chrome';
import { useSplash } from '@/components/splash/splash-provider';
import { SearchOverlay } from '@/components/search/search-overlay';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
const HERO_ROUTES_EXACT = ['/'];
const HERO_ROUTES_PREFIX = ['/about'];

interface NavbarProps {
  readonly navItems?: readonly NavMenuItem[];
}

export function Navbar({ navItems = NAV_ITEMS }: NavbarProps = {}) {
  const pathname = usePathname();
  const editMode = useEditModeUrlOnly();
  if (editMode) return null;
  if (pathname && AUTH_ROUTES.some((r) => pathname.startsWith(r))) return null;

  const hasHero =
    !!pathname &&
    (HERO_ROUTES_EXACT.includes(pathname) ||
      HERO_ROUTES_PREFIX.some((r) => pathname === r || pathname.startsWith(`${r}/`)));

  return <NavbarInner hasHero={hasHero} navItems={navItems} />;
}

function NavbarInner({ hasHero, navItems }: { hasHero: boolean; navItems: readonly NavMenuItem[] }) {
  const { direction, isAtTop } = useScrollDirection(80);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const mobileOpen = useMobileChrome((s) => s.menuOpen);
  const openMobile = useMobileChrome((s) => s.openMenu);
  const closeMobile = useMobileChrome((s) => s.closeMenu);
  const searchOpen = useMobileChrome((s) => s.searchOpen);
  const openSearch = useMobileChrome((s) => s.openSearch);
  const closeSearch = useMobileChrome((s) => s.closeSearch);

  // Global keyboard shortcut: Cmd+K / Ctrl+K / `/` opens search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openSearch]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = useCart((s) => s.count());
  const openCart = useCart((s) => s.openCart);
  const wishlistCount = useWishlist(
    (s) => s.productIds.size + s.guestProductIds.length,
  );
  const { isSplashActive } = useSplash();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  // Transparent over dark hero only. On hero-less routes, always solid.
  // Also force solid when a mega menu is open so nav + dropdown form one continuous panel.
  const isSolid = !isAtTop || !hasHero || !!activeMenu || searchOpen;

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
              {navItems.filter((item) => item.label !== 'About').map((item) => (
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
              className="relative z-50 lg:hidden"
              onClick={openMobile}
              aria-label="Open menu"
            >
              <div className="space-y-1.5">
                <span className={cn('block h-px w-5', isSolid ? 'bg-ink' : 'bg-paper')} />
                <span className={cn('block h-px w-5', isSolid ? 'bg-ink' : 'bg-paper')} />
              </div>
            </button>

            {/* Center logo — shares layoutId with splash gate for FLIP handoff */}
            <Link
              href="/"
              className={cn(
                'absolute left-1/2 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.2em] transition-colors',
                isSolid ? 'text-ink' : 'text-paper'
              )}
            >
              {!mounted || isSplashActive ? (
                <span className={cn('inline-block', isSplashActive && 'opacity-0')}>
                  DENIMISIA
                </span>
              ) : (
                <motion.span
                  layoutId="denimisia-brand-mark"
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                >
                  DENIMISIA
                </motion.span>
              )}
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
                  type="button"
                  onClick={openSearch}
                  aria-label="Search (Cmd+K)"
                  title="Search (⌘K)"
                  className={cn(
                    'transition-colors',
                    isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                  )}
                >
                  <Search size={18} strokeWidth={1.5} />
                </button>
                <Link
                  href="/account/wishlist"
                  aria-label="Wishlist"
                  className={cn(
                    'relative hidden transition-colors sm:block',
                    isSolid ? 'text-ink hover:text-ink/70' : 'text-paper hover:text-paper/70'
                  )}
                >
                  <Heart size={18} strokeWidth={1.5} />
                  {mounted && wishlistCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/account"
                  aria-label="Account"
                  className={cn(
                    'transition-colors',
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
                  {mounted && count > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">
                      {count}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mega menus (desktop) */}
          {navItems.map(
            (item) =>
              item.sections &&
              activeMenu === item.label && (
                <MegaMenu
                  key={item.label}
                  sections={item.sections}
                  featuredImages={item.featuredImages}
                  onMouseEnter={() => handleMenuEnter(item.label)}
                  onMouseLeave={handleMenuLeave}
                  onItemClick={() => setActiveMenu(null)}
                />
              )
          )}

          {/* Inline search dropdown — positioned below nav via top-full */}
          <SearchOverlay open={searchOpen} onClose={closeSearch} />
        </nav>
      </header>

      {/* Mobile menu */}
      <MobileMenu open={mobileOpen} onClose={closeMobile} navItems={navItems} />
    </>
  );
}
