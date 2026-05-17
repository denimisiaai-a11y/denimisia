import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but does NOT reject unauthenticated requests.
 * If a valid JWT is present, req.user is populated.
 * If no JWT or invalid JWT, req.user stays undefined — request proceeds as guest.
 * Used for cart endpoints that serve both guests and logged-in users.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: any, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
