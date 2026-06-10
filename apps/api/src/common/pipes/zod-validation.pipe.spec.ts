import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  it('returns the parsed value on success', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: 'Joy', age: 25 });
    expect(result).toEqual({ name: 'Joy', age: 25 });
  });

  it('strips unknown fields when the schema does not allow them by default', () => {
    const strictSchema = schema.strict();
    const pipe = new ZodValidationPipe(strictSchema);
    expect(() => pipe.transform({ name: 'Joy', age: 25, extra: true })).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException with formatted issues on failure', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: '', age: -1 });
      fail('expected validation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        message: string;
        issues: { path: string; message: string; code: string }[];
      };
      expect(response.message).toBe('Validation failed');
      expect(response.issues.length).toBeGreaterThan(0);
      expect(response.issues[0]).toHaveProperty('path');
      expect(response.issues[0]).toHaveProperty('message');
      expect(response.issues[0]).toHaveProperty('code');
    }
  });

  it('reports root-level errors with (root) path', () => {
    const rootSchema = z.string();
    const pipe = new ZodValidationPipe(rootSchema);
    try {
      pipe.transform(42);
      fail('expected validation to throw');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        issues: { path: string }[];
      };
      expect(response.issues[0].path).toBe('(root)');
    }
  });
});
