import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RobotsHeaderMiddleware } from './common/middleware/robots-header.middleware';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { env } from './common/env';
import { pinoConfig } from './common/logger';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { SearchModule } from './modules/search/search.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ListenersModule } from './common/listeners/listeners.module';
import { BundlesModule } from './modules/bundles/bundles.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { CmsModule } from './modules/cms/cms.module';
import { MediaModule } from './modules/media/media.module';
import { CurationModule } from './modules/curation/curation.module';
import { HealthModule } from './common/health/health.module';
import { BulkModule } from './common/bulk/bulk.module';
import { EmailModule } from './modules/email/email.module';
import { BotModule } from './modules/bot/bot.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { SilhouettesModule } from './modules/silhouettes/silhouettes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      { ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT },
    ]),
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    CollectionsModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    ReturnsModule,
    InventoryModule,
    ReviewsModule,
    DiscountsModule,
    SearchModule,
    UploadsModule,
    AnalyticsModule,
    AuditLogModule,
    ListenersModule,
    BundlesModule,
    CampaignsModule,
    PermissionsModule,
    CmsModule,
    MediaModule,
    CurationModule,
    HealthModule,
    BulkModule,
    EmailModule,
    BotModule,
    InboxModule,
    SilhouettesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RobotsHeaderMiddleware).forRoutes('*');
  }
}
