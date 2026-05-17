import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = [
  'User',
  'Product',
  'ProductVariant',
  'Order',
  'Category',
  'Collection',
  'Review',
  'Discount',
];

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Soft delete middleware: filter out deleted records on read
    this.$use(async (params, next) => {
      if (!SOFT_DELETE_MODELS.includes(params.model ?? '')) {
        return next(params);
      }

      // Read operations: add deletedAt: null filter
      if (
        [
          'findMany',
          'findFirst',
          'findUnique',
          'findFirstOrThrow',
          'findUniqueOrThrow',
          'count',
        ].includes(params.action)
      ) {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};
        // Only add filter if deletedAt is not explicitly queried
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      // Delete → soft delete (update with deletedAt)
      if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = { deletedAt: new Date() };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (!params.args) params.args = {};
        if (!params.args.data) params.args.data = {};
        params.args.data.deletedAt = new Date();
      }

      return next(params);
    });

    // Eager connect, but in development don't block bootstrap if the DB is
    // unreachable — the API still binds its port so non-DB routes work and
    // Prisma lazy-connects on first query. Production still fails fast.
    try {
      await this.$connect();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
      this.logger.warn(
        `Could not eagerly connect to database — API will start anyway; DB-touching routes will error until connectivity is restored. Reason: ${
          (err as Error).message
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
