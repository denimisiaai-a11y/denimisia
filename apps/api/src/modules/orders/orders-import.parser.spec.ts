import { parseOrderHistoryCsv } from './orders-import.parser';

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8');
}

describe('parseOrderHistoryCsv', () => {
  it('parses a single-line order', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors).toEqual([]);
    expect(result.groups.size).toBe(1);
    const group = result.groups.get('OLD-1')!;
    expect(group.header).toMatchObject({
      order_ref: 'OLD-1',
      order_date: '2024-08-15',
      customer_email: 'ada@example.com',
      shipping_cost: 0,
      discount_amount: 0,
    });
    expect(group.items).toEqual([
      { sku: 'SKU-A', quantity: 1, unit_price: 1099 },
    ]);
  });

  it('groups multi-row orders by order_ref (header-row wins)', async () => {
    const csv = `order_ref,order_date,customer_email,customer_name,sku,quantity,unit_price,shipping_cost
OLD-2,2024-09-01,sakib@example.com,Sakib,SKU-A,2,1099,80
OLD-2,2024-09-01,IGNORED@example.com,IGNORED,SKU-B,1,500,9999`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors).toEqual([]);
    const group = result.groups.get('OLD-2')!;
    expect(group.header.customer_email).toBe('sakib@example.com');
    expect(group.header.customer_name).toBe('Sakib');
    expect(group.header.shipping_cost).toBe(80);
    expect(group.items).toEqual([
      { sku: 'SKU-A', quantity: 2, unit_price: 1099 },
      { sku: 'SKU-B', quantity: 1, unit_price: 500 },
    ]);
  });

  it('lowercases the customer_email on the header', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-3,2024-09-01,ADA@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-3')!.header.customer_email).toBe('ada@example.com');
  });

  it('rejects row missing required column (order_date)', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-4,,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, order_ref: 'OLD-4', reason: expect.stringMatching(/order_date/i) },
    ]);
  });

  it('rejects row with invalid email', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-5,2024-09-01,not-an-email,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(0);
    expect(result.errors[0]).toMatchObject({
      row: 2,
      order_ref: 'OLD-5',
      reason: expect.stringMatching(/email/i),
    });
  });

  it('rejects row with quantity <= 0', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-6,2024-09-01,ada@example.com,SKU-A,0,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/quantity/i) });
  });

  it('rejects row with unit_price < 0', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-7,2024-09-01,ada@example.com,SKU-A,1,-5`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/unit_price/i) });
  });

  it('rejects row with unparseable order_date', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-8,not-a-date,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/date/i) });
  });

  it('defaults optional shipping/discount columns to 0 when missing', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-9,2024-09-01,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-9')!.header).toMatchObject({
      shipping_cost: 0,
      discount_amount: 0,
    });
  });

  it('passes through optional address columns when present', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price,ship_line1,ship_city,ship_state,ship_postal,ship_country
OLD-10,2024-09-01,ada@example.com,SKU-A,1,1099,1 Main St,Dhaka,Dhaka,1212,BD`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-10')!.header).toMatchObject({
      ship_line1: '1 Main St',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postal: '1212',
      ship_country: 'BD',
    });
  });

  it('handles UTF-8 BOM-prefixed header', async () => {
    const csv = '﻿' + `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-11,2024-09-01,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(1);
  });

  it('rejects file missing required column header', async () => {
    const csv = `order_ref,order_date,customer_email,quantity,unit_price
OLD-12,2024-09-01,ada@example.com,1,1099`;
    await expect(parseOrderHistoryCsv(csvBuffer(csv))).rejects.toThrow(/required column/i);
  });

  it('rejects file > 20 MB', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(parseOrderHistoryCsv(big)).rejects.toThrow(/File too large/);
  });
});
