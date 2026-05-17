import { Client } from 'pg';

const DEFAULT_TEST_DB_URL =
  'postgresql://denimisia:secret@localhost:5433/denimisia_test';

export default async function globalTeardown(): Promise<void> {
  const testDbUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DB_URL;

  const client = new Client({ connectionString: testDbUrl });
  try {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}
