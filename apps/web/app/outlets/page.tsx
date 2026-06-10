import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Mail } from 'lucide-react';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: 'Outlets',
  description:
    'Denimisia is online-first. Retail appointments available in Dhaka; select pop-up locations planned for 2026.',
  pathname: '/outlets',
});

interface PlannedLocation {
  city: string;
  status: string;
  note: string;
  eta: string;
}

const LOCATIONS: PlannedLocation[] = [
  {
    city: 'Dhaka',
    status: 'Studio Visits',
    note: 'Book an appointment at our Gulshan studio to see current and archive pieces in person.',
    eta: 'Now',
  },
  {
    city: 'Chattogram',
    status: 'Pop-Up',
    note: 'A limited ten-day pop-up featuring the AW25 collection. Pre-register for an invitation.',
    eta: 'Q3 2026',
  },
  {
    city: 'Sylhet',
    status: 'Pop-Up',
    note: 'Trial weekend residency — if demand holds, we return quarterly. Pre-register to be notified.',
    eta: 'Q4 2026',
  },
  {
    city: "Cox's Bazar",
    status: 'Planned',
    note: 'A seasonal residency exploring beach-appropriate cuts. Details to follow.',
    eta: '2027',
  },
];

export default function OutletsPage() {
  return (
    <div className="bg-paper pb-32">
      <SlotHero
        pageKey="outlets"
        slotKey="outlet_card_1"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Studio visits."
        fallbackSubheading="Online-first — with in-person appointments in Dhaka."
        height="h-[45vh] min-h-[320px]"
        priority
      />
      <header className="mx-auto mb-20 mt-16 max-w-[1440px] px-6 md:px-12">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          Online First
        </span>
        <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tight text-ink md:text-6xl lg:text-7xl">
          Outlets &amp;<br />
          Studio Visits
        </h1>
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-[var(--color-secondary)] md:text-base">
          Denimisia operates online-first. We ship from Dhaka to everywhere in Bangladesh and to
          select international markets. For in-person viewing, we offer studio appointments and
          quarterly pop-ups in major cities.
        </p>
      </header>

      <section className="mx-auto mb-24 max-w-[1440px] px-6 md:px-12">
        <div className="grid gap-8 rounded-[20px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-12 md:p-14">
          <div>
            <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-secondary)]">
              Flagship
            </span>
            <h2 className="mb-4 text-3xl font-black uppercase leading-tight tracking-tight text-ink md:text-4xl">
              Gulshan Studio
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-secondary)]">
              Our working studio doubles as a by-appointment showroom. Try on current season
              pieces, view archive cuts, and speak with the design team.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <dt className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
                <MapPin size={13} strokeWidth={1.75} />
                Address
              </dt>
              <dd className="text-sm leading-relaxed text-[var(--color-secondary)]">
                Road 11, Block F, Gulshan 2<br />
                Dhaka 1212, Bangladesh
              </dd>
            </div>
            <div>
              <dt className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
                <Clock size={13} strokeWidth={1.75} />
                Hours
              </dt>
              <dd className="text-sm leading-relaxed text-[var(--color-secondary)]">
                Sat – Thu · 10am – 8pm<br />
                Closed Fridays
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
                <Mail size={13} strokeWidth={1.75} />
                Book a Visit
              </dt>
              <dd>
                <a
                  href="mailto:studio@denimisia.com?subject=Studio%20Visit%20Request"
                  className="text-sm text-ink underline-offset-4 hover:underline"
                >
                  studio@denimisia.com
                </a>
                <p className="mt-1 text-xs text-[var(--color-secondary)]">
                  Please share three preferred time windows.
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
              Pop-Ups &amp; Residencies
            </span>
            <h2 className="text-3xl font-black uppercase leading-tight tracking-tight text-ink md:text-4xl">
              Where We&apos;re Heading
            </h2>
          </div>
          <Link
            href="/contact"
            className="hidden items-center gap-2 border-b border-ink pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-ink transition-opacity hover:opacity-70 md:inline-flex"
          >
            Pre-Register
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-[12px] border border-[var(--color-outline-variant)] bg-[var(--color-outline-variant)] sm:grid-cols-2 lg:grid-cols-4">
          {LOCATIONS.map((loc) => (
            <li
              key={loc.city}
              className="flex flex-col gap-3 bg-paper p-6 transition-colors hover:bg-[var(--color-surface-low)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black uppercase tracking-tight text-ink">
                  {loc.city}
                </h3>
                <span className="shrink-0 rounded-full bg-[var(--color-surface-low)] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-ink">
                  {loc.eta}
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                {loc.status}
              </p>
              <p className="text-xs leading-relaxed text-[var(--color-secondary)]">{loc.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-24 max-w-3xl px-6 text-center md:px-12">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          In the Meantime
        </span>
        <h2 className="mb-6 text-3xl font-black uppercase leading-tight tracking-tight text-ink md:text-4xl">
          Ship anywhere. Free returns.
        </h2>
        <p className="mb-10 text-sm leading-relaxed text-[var(--color-secondary)] md:text-base">
          Orders over BDT 2,000 ship free within Bangladesh. Every piece comes with a 30-day
          free-return window — so the online experience can stand in for retail.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="bg-ink px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-85"
          >
            Start Shopping
          </Link>
          <Link
            href="/contact"
            className="border border-ink/20 px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink transition-colors hover:bg-[var(--color-surface-low)]"
          >
            Get Notified
          </Link>
        </div>
      </section>
    </div>
  );
}
