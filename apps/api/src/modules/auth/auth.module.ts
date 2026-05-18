import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { EmailThrottlerGuard } from '../../common/throttler/email-throttler.guard';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    AuditLogModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    // Route-scoped only — not registered via APP_GUARD. The global
    // ThrottlerGuard still applies to every other endpoint.
    EmailThrottlerGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
