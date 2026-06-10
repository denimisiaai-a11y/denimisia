import 'reflect-metadata';
import {
  CONTROLLER_WATERMARK,
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { BulkOperation } from './bulk-operation.decorator';
import {
  BULK_OPERATION_META,
  BulkOperationMeta,
} from '../bulk/bulk-operation.metadata';
import { ROLES_KEY, Role } from './roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { MaxItemsGuard } from '../guards/max-items.guard';
import { RateLimitInterceptor } from '../interceptors/rate-limit.interceptor';
import { AuditIntentInterceptor } from '../interceptors/audit-intent.interceptor';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';
import { AuditOutcomeInterceptor } from '../interceptors/audit-outcome.interceptor';

// Matrix test for the @BulkOperation decorator stack.
//
// What we lock down here is the WIRING — that applying @BulkOperation(opts)
// to a method attaches:
//   1. The bulk-operation metadata blob (event, endpoint, maxItems, ...)
//   2. The Roles metadata for RolesGuard
//   3. Guards in order: JwtAuthGuard → RolesGuard → MaxItemsGuard
//   4. Interceptors in order: RateLimit → AuditIntent → Transaction → AuditOutcome
//
// The runtime failure-mode matrix (auth missing → role wrong → maxItems →
// rate-limited → tx rolls back → outcome event) is exercised by the
// individual interceptor / guard specs. This file is the structural
// invariant that those specs depend on.

class Target {
  @BulkOperation({
    event: 'product.bulk.feature',
    endpoint: 'POST /products/bulk/feature',
    roles: [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN],
    maxItems: 250,
    rateLimit: { windowMs: 60_000, max: 30 },
    transactional: true,
  })
  doIt(): void {
    /* no-op */
  }

  @BulkOperation({
    event: 'product.bulk.no-tx',
    endpoint: 'POST /products/bulk/no-tx',
    roles: [Role.ADMIN],
    maxItems: 10,
  })
  doItPlain(): void {
    /* no-op */
  }
}

// `doIt` and `doItPlain` are used as metadata keys for Reflect.getMetadata;
// they are never invoked, so unbound-method scoping concerns do not apply.

const doIt = Target.prototype.doIt;

const doItPlain = Target.prototype.doItPlain;

describe('@BulkOperation decorator stack', () => {
  describe('metadata payload', () => {
    it('attaches BULK_OPERATION_META with all declared fields', () => {
      const meta = Reflect.getMetadata(
        BULK_OPERATION_META,
        doIt,
      ) as BulkOperationMeta;

      expect(meta).toEqual({
        event: 'product.bulk.feature',
        endpoint: 'POST /products/bulk/feature',
        maxItems: 250,
        roles: [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN],
        rateLimit: { windowMs: 60_000, max: 30 },
        transactional: true,
      });
    });

    it('defaults transactional to false when omitted', () => {
      const meta = Reflect.getMetadata(
        BULK_OPERATION_META,
        doItPlain,
      ) as BulkOperationMeta;

      expect(meta.transactional).toBe(false);
      expect(meta.rateLimit).toBeUndefined();
    });

    it('attaches @Roles metadata for RolesGuard', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, doIt) as Role[];

      expect(roles).toEqual([Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN]);
    });
  });

  describe('guard order (runs before any interceptor)', () => {
    it('applies JwtAuthGuard → RolesGuard → MaxItemsGuard in that exact order', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, doIt) as unknown[];

      expect(guards).toEqual([JwtAuthGuard, RolesGuard, MaxItemsGuard]);
    });
  });

  describe('interceptor order (locked: RateLimit → AuditIntent → Transaction → AuditOutcome)', () => {
    it('applies all four interceptors in the locked sequence', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        doIt,
      ) as unknown[];

      expect(interceptors).toEqual([
        RateLimitInterceptor,
        AuditIntentInterceptor,
        TransactionInterceptor,
        AuditOutcomeInterceptor,
      ]);
    });

    it('emits the same interceptor stack regardless of options', () => {
      const a = Reflect.getMetadata(INTERCEPTORS_METADATA, doIt) as unknown[];
      const b = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        doItPlain,
      ) as unknown[];

      expect(a).toEqual(b);
    });
  });

  describe('failure-mode contract (matrix)', () => {
    // This matrix encodes the spec's invariant: if a rung fails, every
    // downstream rung must NOT run. Concretely:
    //
    //   stage          | which downstream stages run?
    //   ---------------+--------------------------------------------------
    //   JwtAuthGuard   | none (request rejected with 401)
    //   RolesGuard     | none (403)
    //   MaxItemsGuard  | none (413)
    //   RateLimit      | none — audit-intent / tx / outcome do NOT run (429)
    //   AuditIntent    | tx + handler + outcome run; audit-intent log failure is swallowed
    //   Transaction    | outcome runs with <event>.failed
    //   AuditOutcome   | (final stage; never blocks anything downstream)
    //
    // We assert the structural prerequisites here. Behavioral assertions
    // for each stage live in the individual interceptor / guard specs.
    const matrix: ReadonlyArray<{
      stage: string;
      kind: 'guard' | 'interceptor';
      target: unknown;
      runsBefore: ReadonlyArray<unknown>;
    }> = [
      {
        stage: 'JwtAuthGuard',
        kind: 'guard',
        target: JwtAuthGuard,
        runsBefore: [RolesGuard, MaxItemsGuard],
      },
      {
        stage: 'RolesGuard',
        kind: 'guard',
        target: RolesGuard,
        runsBefore: [MaxItemsGuard],
      },
      {
        stage: 'MaxItemsGuard',
        kind: 'guard',
        target: MaxItemsGuard,
        runsBefore: [],
      },
      {
        stage: 'RateLimitInterceptor',
        kind: 'interceptor',
        target: RateLimitInterceptor,
        runsBefore: [
          AuditIntentInterceptor,
          TransactionInterceptor,
          AuditOutcomeInterceptor,
        ],
      },
      {
        stage: 'AuditIntentInterceptor',
        kind: 'interceptor',
        target: AuditIntentInterceptor,
        runsBefore: [TransactionInterceptor, AuditOutcomeInterceptor],
      },
      {
        stage: 'TransactionInterceptor',
        kind: 'interceptor',
        target: TransactionInterceptor,
        runsBefore: [AuditOutcomeInterceptor],
      },
      {
        stage: 'AuditOutcomeInterceptor',
        kind: 'interceptor',
        target: AuditOutcomeInterceptor,
        runsBefore: [],
      },
    ];

    test.each(matrix)(
      '$stage precedes its downstream stages',
      ({ kind, target, runsBefore }) => {
        const list =
          kind === 'guard'
            ? (Reflect.getMetadata(GUARDS_METADATA, doIt) as unknown[])
            : (Reflect.getMetadata(INTERCEPTORS_METADATA, doIt) as unknown[]);

        const idx = list.indexOf(target);
        expect(idx).toBeGreaterThanOrEqual(0);

        for (const downstream of runsBefore) {
          const dIdx = list.indexOf(downstream);
          expect(dIdx).toBeGreaterThan(idx);
        }
      },
    );
  });

  describe('decorator self-check', () => {
    it('does not mark the decorated method as a controller (no class-level watermark leakage)', () => {
      expect(Reflect.getMetadata(CONTROLLER_WATERMARK, Target)).toBeUndefined();
    });
  });
});
