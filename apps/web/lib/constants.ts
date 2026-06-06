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
  featuredImages?: {
    src: string;
    alt: string;
    href: string;
    /** Optional nav.* slotKey — mega-menu overlays the slot asset on top of `src`. */
    slotKey?: string;
  }[];
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
      {
        src: NAV_FEATURED.shopWomen,
        alt: 'Women collection',
        href: '/shop/women',
        slotKey: 'featured_shop_women',
      },
      {
        src: NAV_FEATURED.shopMen,
        alt: 'Men collection',
        href: '/shop/men',
        slotKey: 'featured_shop_men',
      },
    ],
  },
  {
    label: 'Collection',
    sections: [
      {
        title: 'All Collections',
        // Dynamically augmented by buildNavWithCollections() in app/layout.tsx —
        // active collections marked showInNav=true are inserted here at request
        // time, ordered by navOrder. Static "All Collections" link below ensures
        // the menu is never empty even if no collection opts in.
        items: [
          { label: 'All Collections', href: '/collections' },
        ],
      },
    ],
    featuredImages: [
      {
        src: NAV_FEATURED.collectionLatest,
        alt: 'Latest collection',
        href: '/collections',
        slotKey: 'featured_collection_latest',
      },
    ],
  },
  {
    label: 'Series',
    sections: [
      {
        title: 'Tops',
        items: [
          { label: 'All', href: '/series/tops' },
          { label: 'Shackets', href: '/series/tops/shackets' },
          { label: 'Shirts', href: '/series/tops/shirts' },
          { label: 'Jackets', href: '/series/tops/jackets' },
          { label: 'T-shirts', href: '/series/tops/t-shirts' },
          { label: 'Tracksuits', href: '/series/tops/tracksuits' },
          { label: 'Sweaters', href: '/series/tops/sweaters' },
          { label: 'Hoodies', href: '/series/tops/hoodies' },
          { label: 'Checks', href: '/series/tops/checks' },
        ],
      },
      {
        title: 'Pants',
        items: [
          { label: 'All', href: '/series/pants' },
          { label: 'Track Pants', href: '/series/pants/track-pants' },
          { label: 'Denims', href: '/series/pants/denims' },
          { label: 'Trousers', href: '/series/pants/trousers' },
        ],
      },
    ],
    featuredImages: [
      {
        src: NAV_FEATURED.seriesBestSellers,
        alt: 'Best sellers',
        href: '/series/tops',
        slotKey: 'featured_series_bestsellers',
      },
      {
        src: NAV_FEATURED.seriesWideLeg,
        alt: 'Wide leg pants',
        href: '/series/pants',
        slotKey: 'featured_series_wide_leg',
      },
    ],
  },
  {
    label: 'About',
    href: '/about',
  },
];

export const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://www.facebook.com/denimisia', icon: 'facebook' as const },
  { label: 'Instagram', href: 'https://www.instagram.com/denimisia.bd/', icon: 'instagram' as const },
  { label: 'TikTok', href: 'https://tiktok.com/@denimisia', icon: 'music' as const },
];

export const FOOTER_COLUMNS = [
  {
    title: 'Company Info',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Career', href: '/career' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
  {
    title: 'Help & Support',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Size Guide', href: '/size-guide' },
      { label: 'Outlets', href: '/outlets' },
      { label: 'Sitemap', href: '/sitemap' },
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
  "DENIMISIA\u2122 \u00b7 SPRING'26 \u00b7 FREE DELIVERY OVER BDT 1,500 \u00b7 DENIMISIA\u2122 \u00b7 SPRING'26 \u00b7 FREE DELIVERY OVER BDT 1,500";

export const ANNOUNCEMENT_MESSAGES = [
  'FREE SHIPPING ON ORDERS OVER BDT 2,000',
  'MADE IN BANGLADESH \u00b7 PREMIUM QUALITY',
  'LIMITED SERIES: RAW DENIM COLLECTION OUT NOW',
];

export const BESTSELLER_TABS = ['Wide Leg', 'Baggy', 'Cargo', 'Jackets'];

export interface CategoryCard {
  label: string;
  subtitle: string;
  href: string;
  image: string;
}

import { CATEGORY_IMAGES, NAV_FEATURED } from './placeholder-images';

export const CATEGORY_CARDS: CategoryCard[] = [
  {
    label: 'Tops',
    subtitle: 'The Essential Foundation',
    href: '/series/tops',
    image: CATEGORY_IMAGES.tops,
  },
  {
    label: 'Denims',
    subtitle: 'Signature Craftsmanship',
    href: '/series/pants/denims',
    image: CATEGORY_IMAGES.denims,
  },
  {
    label: 'Jackets',
    subtitle: 'Structured Outerwear',
    href: '/series/tops/jackets',
    image: CATEGORY_IMAGES.jackets,
  },
];
