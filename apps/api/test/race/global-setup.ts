import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TEST_DB_URL =
  'postgresql://denimisia:secret@localhost:5433/denimisia_test';

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

  // existsSync confirms the path resolves to a real file but does not
  // strip shell metacharacters. Reject any double-quote in schemaPath so
  // the command string below stays well-formed even on a pathological cwd.
  if (schemaPath.includes('"')) {
    throw new Error(
      `Prisma schema path ${schemaPath} contains a double-quote character; ` +
        `move the project to a path without quotes.`,
    );
  }

  // Apply the version-controlled migration history. The earlier db push
  // workaround is gone now that migration 20260518000000_baseline_reset_
  // capture_drift captures the schema features (auth columns, CMS tables,
  // updatedAt default cleanups) that had drifted into the live DB via
  // unrecorded db push runs.
  //
  // execSync with a string command (rather than execFileSync + shell:true)
  // avoids the Node 22 DEP0190 deprecation. Every command token is a
  // literal constant except schemaPath, which is derived from
  // process.cwd() inside the repo and guarded above against quotes.
  execSync(`pnpm prisma migrate deploy --schema "${schemaPath}"`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
    },
  });
}
