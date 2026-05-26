import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ABOUT_HERO, ABOUT_MESSAGE } from '@/lib/placeholder-images';
import { fetchPageSlots, pickSlot, resolveSlotText, resolveSlotUrl } from '@/lib/page-slots';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: 'About Us',
  description:
    'Denimisia — premium denim crafted in Bangladesh. Honest pricing, sustainable practices, and quality that lasts.',
  pathname: '/about',
});

const values = [
  {
    icon: '\u2726',
    title: 'Quality First',
    description:
      'Every pair is built to endure. We select premium fabrics and finishes so our denim ages beautifully, not disposably.',
  },
  {
    icon: '\u25CB',
    title: 'Honest Pricing',
    description:
      'No inflated markups, no fake sales. We price transparently so you always know exactly what you are paying for.',
  },
  {
    icon: '\u2740',
    title: 'Sustainable Practice',
    description:
      'From water-saving washes to responsible sourcing, we build sustainability into every step of our supply chain.',
  },
  {
    icon: '\u25C7',
    title: 'Made in Bangladesh',
    description:
      'Bangladesh is the birthplace of world-class denim. We partner with local artisans and factories to bring that craft directly to you.',
  },
] as const;

const stats = [
  { figure: '500+', label: 'Styles' },
  { figure: '50,000+', label: 'Happy Customers' },
  { figure: '100%', label: 'Bangladeshi Made' },
  { figure: 'Premium', label: 'Quality Guaranteed' },
] as const;

export default async function AboutPage() {
  const slots = await fetchPageSlots('about');
  const heroSlot  = pickSlot(slots, 'about_hero');
  const storySlot = pickSlot(slots, 'about_story_image');
  const hero  = resolveSlotUrl(heroSlot, ABOUT_MESSAGE);
  const story = resolveSlotUrl(storySlot, ABOUT_HERO);
  const heroHeading = resolveSlotText(heroSlot, 'Our Story', 'heading');
  const heroSub     = resolveSlotText(heroSlot, 'Premium denim, honestly priced — crafted with pride in Bangladesh.', 'subheading');

  return (
    <main>
      {/* ── Hero Section ─────────────────────────────────── */}
      <section
        data-slot="about.about_hero"
        className="relative h-[50vh] min-h-[400px] w-full overflow-hidden"
      >
        {hero.kind === 'VIDEO' ? (
          <video
            data-slot-field="media"
            src={hero.src}
            poster={hero.poster ?? undefined}
            autoPlay muted loop playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            data-slot-field="media"
            src={hero.src}
            alt={heroSlot?.altText ?? 'Denimisia craftsmanship'}
            fill
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-ink/50" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-paper">
          <h1
            data-slot-field="heading"
            className="text-4xl font-medium uppercase tracking-[0.2em] md:text-5xl lg:text-6xl"
          >
            {heroHeading}
          </h1>
          <p
            data-slot-field="subheading"
            className="mt-4 max-w-xl text-base font-light tracking-wide text-paper/80 md:text-lg"
          >
            {heroSub}
          </p>
        </div>
      </section>

      {/* ── Story Section ────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-12 lg:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
          {/* Image */}
          <div
            data-slot="about.about_story_image"
            className="relative aspect-[4/5] w-full overflow-hidden"
          >
            <Image
              data-slot-field="media"
              src={story.src}
              alt={storySlot?.altText ?? 'Denimisia denim story'}
              fill
              className="object-cover"
            />
          </div>

          {/* Text */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Who We Are
            </h2>
            <h3 className="mt-3 text-3xl font-medium uppercase tracking-[0.15em] text-ink md:text-4xl">
              Crafted to Last
            </h3>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted">
              <p>
                Denimisia was born from a simple belief: premium denim should not
                cost a fortune. Bangladesh produces some of the finest denim in
                the world, yet that craftsmanship rarely reaches consumers at a
                fair price.
              </p>
              <p>
                We changed that. By working directly with skilled artisans and
                cutting out unnecessary middlemen, we deliver jeans that rival
                luxury labels — at prices that respect your wallet.
              </p>
              <p>
                Every stitch, every wash, every detail is intentional. Our denim
                is not made to follow fast-fashion cycles. It is made to last, to
                soften with wear, and to become unmistakably yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values Section ───────────────────────────────── */}
      <section className="bg-muted-bg">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-12 lg:py-28">
          <div className="text-center">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              What We Stand For
            </h2>
            <h3 className="mt-3 text-3xl font-medium uppercase tracking-[0.15em] text-ink md:text-4xl">
              Our Values
            </h3>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div
                key={v.title}
                className="flex flex-col items-center border border-border bg-paper px-6 py-10 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center border border-ink text-2xl text-ink">
                  {v.icon}
                </span>
                <h4 className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-ink">
                  {v.title}
                </h4>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Numbers Section ──────────────────────────────── */}
      <section className="border-y border-border bg-muted-bg">
        <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12">
          <div className="grid gap-10 text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-medium uppercase tracking-[0.15em] text-ink md:text-3xl">
                  {s.figure}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-[1440px] px-6 py-20 text-center lg:px-12 lg:py-28">
          <h2 className="text-3xl font-medium uppercase tracking-[0.2em] text-paper md:text-4xl">
            Visit Our Store
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-paper/70">
            Experience Denimisia in person. Find your perfect fit at one of our
            outlets, or reach out — we would love to hear from you.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/outlets" className="btn-pill-white">
              Find Our Outlets
            </Link>
            <Link href="/contact" className="btn-pill">
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
