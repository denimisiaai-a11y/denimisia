import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TEST_DB_URL =
  'postgresql://denimisia:secret@localhost:5433/denimisia_test';

const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export default function globalSetup(): void {
  const testDbUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DB_URL;

  process.env.DATABASE_URL = testDbUrl;
  process.env.DIRECT_URL = testDbUrl;

  const schemaPath = resolve(
    process.cwd(),
    '..',
    '..',
    'packages',
    'database',
    'prisma',
    'schema.prisma',
  );

  if (!existsSync(schemaPath)) {
    throw new Error(
      `Prisma schema not found at ${schemaPath}. ` +
        `globalSetup expects jest to run from apps/api (cwd=${process.cwd()}). ` +
        `Override with TEST_PRISMA_SCHEMA env var if running from elsewhere.`,
    );
  }

  execFileSync(
    PNPM_BIN,
    ['prisma', 'migrate', 'deploy', '--schema', schemaPath],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        DIRECT_URL: testDbUrl,
      },
    },
  );
}
