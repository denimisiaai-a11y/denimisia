import { forwardRef } from 'react';

interface FieldProps {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
  readonly hint?: string;
}

export function Field({ label, name, error, required, children, hint }: FieldProps) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
          {label}
          {required && <span className="ml-1 text-primary">*</span>}
        </span>
        {hint && (
          <span className="text-[10px] text-secondary/70">{hint}</span>
        )}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] font-semibold text-primary">
          {error}
        </span>
      )}
    </label>
  );
}

const INPUT_BASE =
  'w-full border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body text-sm text-on-surface transition-colors duration-200 placeholder:text-secondary/60 focus:border-on-surface focus:outline-none disabled:opacity-50';

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    return <input ref={ref} {...props} className={INPUT_BASE + ' ' + (props.className ?? '')} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    return (
      <textarea
        ref={ref}
        rows={props.rows ?? 3}
        {...props}
        className={INPUT_BASE + ' resize-y ' + (props.className ?? '')}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return (
      <select
        ref={ref}
        {...props}
        className={INPUT_BASE + ' ' + (props.className ?? '')}
      />
    );
  },
);

export function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { readonly label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        {...rest}
        className="h-4 w-4 border-outline-variant/40 text-on-surface focus:ring-0"
      />
      <span className="font-body text-sm text-on-surface">{label}</span>
    </label>
  );
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
