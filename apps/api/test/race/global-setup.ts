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

  // Use prisma db push rather than migrate deploy so the test DB tracks
  // the current schema.prisma rather than the migration history. The repo
  // has at least one column (User.isActive, User.tokenVersion) present in
  // schema.prisma but not yet captured in a migration file; migrate
  // deploy would produce a DB the login path cannot query.
  //
  // execSync with a string command (rather than execFileSync + shell:true)
  // avoids the Node 22 DEP0190 deprecation. Every command token is a
  // literal constant except schemaPath, which is derived from
  // process.cwd() inside the repo and guarded above against quotes.
  execSync(
    `pnpm prisma db push --skip-generate --accept-data-loss --schema "${schemaPath}"`,
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
