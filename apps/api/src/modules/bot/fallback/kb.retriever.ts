import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KbFaqLoader, FaqChunk } from './kb.faq.loader';

export interface RetrievedProduct {
  id: string;
  name: string;
  slug: string;
}

export interface RetrievedOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
}

export interface RetrievedContext {
  faqChunks: FaqChunk[];
  products: RetrievedProduct[];
  userOrders: RetrievedOrder[];
}

export interface RetrieveOpts {
  userId?: string;
}

const STOPWORDS = new Set([
  'a','an','the','is','are','do','does','you','your','my','i','we','can','to','of','for','in','on','and','or','at','with','from','any','some','have','has',
]);

@Injectable()
export class KbRetriever {
  constructor(
    private readonly faqLoader: KbFaqLoader,
    private readonly prisma: PrismaService,
  ) {}

  async retrieve(query: string, opts: RetrieveOpts): Promise<RetrievedContext> {
    const [faqChunks, products, userOrders] = await Promise.all([
      Promise.resolve(this.faqLoader.search(query, 2)),
      this.searchProducts(query),
      this.fetchUserOrders(opts.userId),
    ]);
    return { faqChunks, products, userOrders };
  }

  private async searchProducts(query: string): Promise<RetrievedProduct[]> {
    const terms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));
    if (terms.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: {
        OR: terms.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })),
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true },
      take: 3,
    });
    return rows;
  }

  private async fetchUserOrders(userId?: string): Promise<RetrievedOrder[]> {
    if (!userId) return [];
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, orderNumber: true, status: true, createdAt: true },
    });
    return rows;
  }
}
