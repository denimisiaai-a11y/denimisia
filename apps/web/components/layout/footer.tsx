'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditModeUrlOnly } from '@/hooks/use-iframe-edit-mode';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
import { SOCIAL_LINKS, FOOTER_COLUMNS } from '@/lib/constants';

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.52a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.13a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-.8.04h-.39z" />
    </svg>
  );
}

const ICON_MAP = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  music: TikTokIcon,
} as const;

export function Footer() {
  const pathname = usePathname();
  const editMode = useEditModeUrlOnly();
  if (editMode) return null;
  if (pathname && AUTH_ROUTES.some((r) => pathname.startsWith(r))) return null;

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
                <Icon />
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
