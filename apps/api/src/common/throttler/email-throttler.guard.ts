import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-email login throttle.
 *
 * Extends the default ThrottlerGuard to compose the tracker from both the
 * caller's IP and the target email, so an attacker cannot enumerate or
 * brute-force a specific account by rotating IPs (or by bypassing the
 * IP-only bucket with many victims on one IP, e.g. behind a NAT).
 *
 * Tracker format: `${ip}:${email.toLowerCase().trim()}`
 * Missing email falls back to an empty segment, matching bare IP throttling.
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = typeof req.ip === 'string' ? req.ip : '';
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const email = rawEmail.toLowerCase().trim();
    return Promise.resolve(`${ip}:${email}`);
  }
}
