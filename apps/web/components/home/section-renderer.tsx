/**
 * Section type → component switch.
 *
 * SectionRenderer is intentionally dumb: page.tsx pre-fetches all the data
 * any section might need (products, bundles, etc.) into a single bag, then
 * SectionRenderer picks the slice each section type needs.
 *
 * Multi-instance behaviour:
 * - Slot-based sections (Hero, CategoryCards, BrandStory) read the SAME
 *   slot keys regardless of how many instances exist. Two HERO instances
 *   show identical content (intentional — they're slot-driven).
 * - EditorialBanner accepts a `slotGroupKey` so two instances can point
 *   at different slot groups (e.g., home.editorial + home.editorial_secondary).
 * - Product-row sections (NewArrivals, Trending, Bestsellers) currently
 *   show the same data across instances. Per-instance product filtering
 *   is a v2 extension.
 */

import { HeroSection } from '@/components/home/hero-section';
import { CategoryCards } from '@/components/home/category-cards';
import { NewArrivals } from '@/components/home/new-arrivals';
import { EditorialBanner } from '@/components/home/editorial-banner';
import { BundleDeals } from '@/components/home/bundle-deals';
import { TrendingSection } from '@/components/home/trending-section';
import { BestSellers } from '@/components/home/best-sellers';
import { BrandStory } from '@/components/home/brand-story';
import {
  type HomepageSection,
  readEditorialBannerConfig,
  readNewArrivalsConfig,
  readBundleDealsConfig,
  readTrendingConfig,
  readBestsellersConfig,
} from '@/lib/homepage-sections';

interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage: string | undefined;
  colourCount: number;
  showStarBadge: boolean;
}

export interface SectionData {
  newArrivals: ProductCard[];
  trending: ProductCard[];
  bestsellers: ProductCard[];
}

interface SectionRendererProps {
  readonly section: HomepageSection;
  readonly data: SectionData;
}

export async function SectionRenderer({ section, data }: SectionRendererProps) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection />;

    case 'CATEGORY_CARDS':
      return <CategoryCards />;

    case 'NEW_ARRIVALS': {
      const cfg = readNewArrivalsConfig(section.config);
      return (
        <NewArrivals
          products={data.newArrivals}
          title={cfg.title}
          limit={cfg.limit}
        />
      );
    }

    case 'EDITORIAL_BANNER': {
      const { slotGroupKey } = readEditorialBannerConfig(section.config);
      return <EditorialBanner slotGroupKey={slotGroupKey} />;
    }

    case 'BUNDLE_DEALS': {
      const cfg = readBundleDealsConfig(section.config);
      return <BundleDeals title={cfg.title} limit={cfg.limit} />;
    }

    case 'TRENDING': {
      const cfg = readTrendingConfig(section.config);
      return (
        <TrendingSection
          products={data.trending}
          title={cfg.title}
          limit={cfg.limit}
        />
      );
    }

    case 'BESTSELLERS': {
      const cfg = readBestsellersConfig(section.config);
      return <BestSellers products={data.bestsellers} title={cfg.title} />;
    }

    case 'BRAND_STORY':
      return <BrandStory />;
  }
}
