import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodIssue, ZodType } from 'zod';

interface FormattedIssue {
  path: string;
  message: string;
  code: string;
}

@Injectable()
export class ZodValidationPipe<
  TSchema extends ZodType,
> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new BadRequestException({
      message: 'Validation failed',
      issues: formatIssues(result.error),
    });
  }
}

function formatIssues(error: ZodError): FormattedIssue[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path.length === 0 ? '(root)' : issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
