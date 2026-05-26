import { parse } from 'csv-parse';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const REQUIRED_COLUMNS = [
  'order_ref',
  'order_date',
  'customer_email',
  'sku',
  'quantity',
  'unit_price',
] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedItem {
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface OrderHeader {
  order_ref: string;
  order_date: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  shipping_cost: number;
  discount_amount: number;
  ship_line1: string;
  ship_city: string;
  ship_state: string;
  ship_postal: string;
  ship_country: string;
  notes: string;
}

export interface OrderGroup {
  header: OrderHeader;
  items: ParsedItem[];
}

export interface ParseRowError {
  row: number;
  order_ref?: string;
  reason: string;
}

export interface ParseResult {
  groups: Map<string, OrderGroup>;
  errors: ParseRowError[];
}

/**
 * Two-pass CSV ingestion for order history. Reads the whole file into
 * memory (capped at 20 MB), validates each row, groups by order_ref with
 * header-row-wins semantics. The caller (service) handles DB writes.
 */
export async function parseOrderHistoryCsv(buffer: Buffer): Promise<ParseResult> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max 20 MB, got ${buffer.length} bytes)`);
  }

  return new Promise((resolve, reject) => {
    const groups = new Map<string, OrderGroup>();
    const errors: ParseRowError[] = [];
    let lineNum = 1;

    const parser = parse({
      columns: (header: string[]) => {
        if (header[0]?.charCodeAt(0) === 0xfeff) {
          header[0] = header[0].slice(1);
        }
        for (const required of REQUIRED_COLUMNS) {
          if (!header.includes(required)) {
            parser.destroy(new Error(`Missing required column: ${required}`));
            return header;
          }
        }
        return header;
      },
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('data', (record: Record<string, string>) => {
      lineNum += 1;
      const order_ref = (record.order_ref ?? '').trim();
      if (!order_ref) {
        errors.push({ row: lineNum, reason: 'Missing order_ref' });
        return;
      }
      const order_date = (record.order_date ?? '').trim();
      if (!order_date) {
        errors.push({ row: lineNum, order_ref, reason: 'Missing order_date' });
        return;
      }
      const parsedDate = new Date(order_date);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push({ row: lineNum, order_ref, reason: `Unparseable order_date: "${order_date}"` });
        return;
      }
      const email = (record.customer_email ?? '').trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email)) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid customer_email: "${email}"` });
        return;
      }
      const sku = (record.sku ?? '').trim();
      if (!sku) {
        errors.push({ row: lineNum, order_ref, reason: 'Missing sku' });
        return;
      }
      const quantity = Number(record.quantity);
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid quantity: "${record.quantity}"` });
        return;
      }
      const unit_price = Number(record.unit_price);
      if (!Number.isFinite(unit_price) || unit_price < 0) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid unit_price: "${record.unit_price}"` });
        return;
      }

      let group = groups.get(order_ref);
      if (!group) {
        const shipping_cost = Number(record.shipping_cost ?? '0') || 0;
        const discount_amount = Number(record.discount_amount ?? '0') || 0;
        group = {
          header: {
            order_ref,
            order_date,
            customer_email: email,
            customer_name: (record.customer_name ?? '').trim(),
            customer_phone: (record.customer_phone ?? '').trim(),
            shipping_cost,
            discount_amount,
            ship_line1: (record.ship_line1 ?? '').trim(),
            ship_city: (record.ship_city ?? '').trim(),
            ship_state: (record.ship_state ?? '').trim(),
            ship_postal: (record.ship_postal ?? '').trim(),
            ship_country: (record.ship_country ?? '').trim(),
            notes: (record.notes ?? '').trim(),
          },
          items: [],
        };
        groups.set(order_ref, group);
      }
      group.items.push({ sku, quantity, unit_price });
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve({ groups, errors }));

    parser.write(buffer);
    parser.end();
  });
}
