import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Product',
  'ProductVariant',
  'Order',
  'Category',
  'Collection',
  'Review',
  'Discount',
]);

const READ_ACTIONS = new Set<string>([
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
]);

/**
 * Static map of model → (relationName → relatedModelName).
 *
 * Built once at module init from Prisma.dmmf.datamodel. Used by the
 * soft-delete middleware to figure out which `include` / `select` keys
 * point at soft-deletable models so it can inject `where: { deletedAt: null }`
 * automatically — Prisma's `$use` middleware ONLY filters the top-level
 * model, never the relations, which is why deleted ProductVariant rows
 * appeared to "reappear" in admin product edit pages: the variants
 * relation include skipped the filter.
 */
interface RelationInfo {
  readonly relatedModel: string;
  // True for one-to-many (`variants ProductVariant[]`); false for the
  // singular back-reference (`product Product`). Prisma rejects a `where`
  // filter on scalar/many-to-one relations at runtime, so we can only
  // inject `deletedAt: null` on isList=true relations.
  readonly isList: boolean;
}

function buildRelationMap(): Map<string, Map<string, RelationInfo>> {
  const map = new Map<string, Map<string, RelationInfo>>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const relations = new Map<string, RelationInfo>();
    for (const field of model.fields) {
      if (field.kind === 'object' && field.type) {
        relations.set(field.name, {
          relatedModel: field.type,
          isList: field.isList === true,
        });
      }
    }
    map.set(model.name, relations);
  }
  return map;
}

const RELATION_MAP = buildRelationMap();

/**
 * Walks an `include` or `select` config tree and, for any relation key
 * that points at a soft-deletable model, ensures `where: { deletedAt: null }`
 * is set. Respects an explicit caller override — if the caller already
 * supplied `where: { deletedAt: <anything> }` we leave it alone (so admin
 * tooling can read tombstones by passing `{ deletedAt: { not: null } }`).
 *
 * Recurses through nested includes so a chain like
 *   Order → items → product → variants
 * gets filtered at every soft-deletable hop.
 */
function applyRelationSoftDeleteFilters(
  config: unknown,
  parentModel: string | undefined,
): void {
  if (!config || typeof config !== 'object') return;
  if (!parentModel) return;
  const relations = RELATION_MAP.get(parentModel);
  if (!relations) return;

  const block = config as Record<string, unknown>;
  for (const [key, value] of Object.entries(block)) {
    const info = relations.get(key);
    if (!info) continue; // not a relation — skip scalar fields

    const { relatedModel, isList } = info;
    const isSoftDeletable = SOFT_DELETE_MODELS.has(relatedModel);
    // `where` is only valid on list (one-to-many) relations in Prisma. On
    // scalar (many-to-one) relations like `cartItem.product`, adding
    // `where` triggers "Invalid query parameters" at runtime. So we only
    // inject the soft-delete filter on list relations and let many-to-one
    // relations through. (The parent row still loads; if the related row
    // is soft-deleted the caller can detect deletedAt themselves.)
    const canInjectWhere = isSoftDeletable && isList;

    if (value === true) {
      if (canInjectWhere) {
        block[key] = { where: { deletedAt: null } };
      }
      continue;
    }

    if (typeof value !== 'object' || value === null) continue;

    const child = value as Record<string, unknown>;

    if (canInjectWhere) {
      const where = (child.where as Record<string, unknown> | undefined) ?? {};
      if (where.deletedAt === undefined) {
        child.where = { ...where, deletedAt: null };
      }
    }

    // Recurse regardless of list-vs-scalar — deeply chained relations like
    // CampaignProduct → product → variants still need each soft-deletable
    // list relation filtered at its own hop.
    if (child.include) applyRelationSoftDeleteFilters(child.include, relatedModel);
    if (child.select) applyRelationSoftDeleteFilters(child.select, relatedModel);
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.$use(async (params, next) => {
      const model = params.model;
      if (!model) return next(params);

      const isSoftDeletable = SOFT_DELETE_MODELS.has(model);

      // ── Top-level read: auto-add `deletedAt: null` filter to where ──
      if (isSoftDeletable && READ_ACTIONS.has(params.action)) {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      // ── Top-level delete → soft delete (Prisma 4 middleware idiom) ──
      if (isSoftDeletable && params.action === 'delete') {
        params.action = 'update';
        if (!params.args) params.args = {};
        params.args.data = { deletedAt: new Date() };
      }

      if (isSoftDeletable && params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (!params.args) params.args = {};
        if (!params.args.data) params.args.data = {};
        params.args.data.deletedAt = new Date();
      }

      // ── Relations: recurse into include + select on ANY query that
      //     loads relations, regardless of whether the top-level model
      //     is soft-deletable. E.g. CartItem isn't soft-deletable but
      //     its `product` and `variant` relations are.
      if (params.args?.include) {
        applyRelationSoftDeleteFilters(params.args.include, model);
      }
      if (params.args?.select) {
        applyRelationSoftDeleteFilters(params.args.select, model);
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
