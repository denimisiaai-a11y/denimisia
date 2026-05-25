import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';
import { corsOrigins, env } from './common/env';

async function main(): Promise<void> {
  const logger = new Logger('Main');
  const app = await createApp();
  await app.listen(env.PORT);
  logger.log(
    `API listening on :${env.PORT} · env=${env.NODE_ENV} · cors=${corsOrigins().join(',')}`,
  );
}

main().catch((err: unknown) => {
  console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
