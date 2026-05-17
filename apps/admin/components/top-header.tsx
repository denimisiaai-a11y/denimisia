'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

interface TopHeaderProps {
  userEmail: string;
  userRole: string;
  onSignOut: () => void;
  searchPlaceholder?: string;
  displayName?: string;
}

export function TopHeader({
  userEmail,
  userRole,
  onSignOut,
  searchPlaceholder = 'Search the atelier…',
  displayName,
}: TopHeaderProps) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    function onClick(e: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notificationsOpen]);

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark');
  const emailHandle = userEmail.split('@')[0] || 'admin';
  const initials = emailHandle.slice(0, 2).toUpperCase();
  const name = displayName && displayName.trim().length > 0 ? displayName : emailHandle;

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    router.push(`/products?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/15 bg-white/60 px-8 backdrop-blur-md dark:bg-ink/60">
      <div className="flex w-1/3 items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xs" role="search">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-secondary" aria-hidden>
            search
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="w-full border-0 border-b border-outline-variant/20 bg-transparent py-2 pl-10 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
          />
        </form>
      </div>

      <div className="flex items-center space-x-5">
        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
          className="flex items-center justify-center text-secondary transition-colors duration-300 ease-editorial hover:text-primary"
        >
          <span className="material-symbols-outlined" aria-hidden>{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
            className="relative text-secondary transition-colors duration-300 ease-editorial hover:text-primary"
          >
            <span className="material-symbols-outlined" aria-hidden>notifications</span>
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          </button>

          {notificationsOpen && (
            <div
              role="menu"
              aria-label="Notifications"
              className="absolute right-0 top-full mt-3 w-80 bg-surface-container-lowest shadow-[0_20px_40px_rgba(27,28,28,0.06)] ring-1 ring-outline-variant/10"
            >
              <div className="border-b border-outline-variant/15 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Notifications
                </p>
              </div>
              <div className="px-4 py-10 text-center">
                <span className="material-symbols-outlined mb-2 text-2xl text-secondary/60" aria-hidden>
                  notifications_off
                </span>
                <p className="font-body text-xs uppercase tracking-[0.2em] text-secondary">
                  No notifications
                </p>
                <p className="mt-1 font-body text-[11px] text-secondary/70">
                  You are all caught up.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open user menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="group flex items-center space-x-3"
          >
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface">{name}</p>
              <p className="text-[10px] uppercase tracking-wider text-secondary">{userRole}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-sm border border-outline-variant/20 bg-surface-container text-[11px] font-semibold uppercase tracking-wider text-ink dark:text-white">
              {initials}
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-3 w-56 bg-surface-container-lowest shadow-[0_20px_40px_rgba(27,28,28,0.06)] ring-1 ring-outline-variant/10"
            >
              <div className="border-b border-outline-variant/15 px-4 py-3">
                <p className="truncate text-xs font-semibold text-on-surface">{userEmail}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-secondary">{userRole}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary transition-colors duration-300 ease-editorial hover:bg-surface-container hover:text-primary"
              >
                <span className="material-symbols-outlined mr-3 text-base" aria-hidden>logout</span>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
