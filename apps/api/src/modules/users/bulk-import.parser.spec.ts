import { parseAndDedupeCsv } from './bulk-import.parser';

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8');
}

describe('parseAndDedupeCsv', () => {
  it('parses a basic CSV with header row', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01776902711
grace@example.com,Grace,Hopper,`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.rows.get('ada@example.com')).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '01776902711',
    });
    expect(result.rows.get('grace@example.com')).toMatchObject({
      email: 'grace@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '',
    });
  });

  it('lowercases emails in the map key', async () => {
    const csv = `email,firstName,lastName,phone
ADA@EXAMPLE.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.get('ada@example.com')).toBeDefined();
    expect(result.rows.size).toBe(1);
  });

  it('first row wins on duplicate email; later rows fill blanks only', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,,01776902711
ada@example.com,IGNORE,Lovelace,02000000000`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    const ada = result.rows.get('ada@example.com');
    expect(ada).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '01776902711',
    });
    expect(result.duplicates).toEqual([{ row: 3, email: 'ada@example.com' }]);
  });

  it('reports invalid email as error and skips row', async () => {
    const csv = `email,firstName,lastName,phone
not-an-email,X,Y,
ada@example.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('Invalid email') },
    ]);
  });

  it('reports missing firstName as error', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,,Lovelace,`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('firstName') },
    ]);
  });

  it('reports invalid phone as error and skips row', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,abc123`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('phone') },
    ]);
  });

  it('handles BOM-prefixed UTF-8 CSV', async () => {
    const csv = '﻿' + `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('rejects file with no header row', async () => {
    const csv = `not,a,real,header
ada@example.com,Ada,Lovelace,01776902711`;
    await expect(parseAndDedupeCsv(csvBuffer(csv))).rejects.toThrow(
      /Missing required column/,
    );
  });

  it('rejects file exceeding 20 MB', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(parseAndDedupeCsv(big)).rejects.toThrow(/File too large/);
  });
});
