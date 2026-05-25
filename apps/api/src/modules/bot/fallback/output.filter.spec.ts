import { OutputFilter } from './output.filter';

describe('OutputFilter', () => {
  const f = new OutputFilter();

  it('passes safe text unchanged', () => {
    const out = f.scrub('We sell jeans and jackets.');
    expect(out.filtered).toBe('We sell jeans and jackets.');
    expect(out.hadStripping).toBe(false);
  });

  it('redacts a BD mobile number', () => {
    const out = f.scrub('Call 01712345678 for help');
    expect(out.filtered).toContain('[redacted]');
    expect(out.filtered).not.toContain('01712345678');
    expect(out.hadStripping).toBe(true);
  });

  it('redacts a +880 number', () => {
    const out = f.scrub('Phone: +8801712345678');
    expect(out.filtered).toContain('[redacted]');
  });

  it('redacts an email', () => {
    const out = f.scrub('write to admin@example.com');
    expect(out.filtered).toContain('[redacted]');
    expect(out.filtered).not.toContain('admin@example.com');
  });

  it('counts multiple PII patterns', () => {
    const out = f.scrub('01712345678 and admin@x.com');
    expect(out.patternCount).toBeGreaterThanOrEqual(2);
  });
});
