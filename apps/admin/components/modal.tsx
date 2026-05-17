'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly width?: 'sm' | 'md' | 'lg';
}

const WIDTH_CLASS: Record<NonNullable<ModalProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: ModalProps) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={
          'atelier-shadow relative w-full overflow-hidden bg-surface-container-lowest ' +
          WIDTH_CLASS[width]
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between border-b border-outline-variant/15 px-6 py-4">
          <div>
            <h3 className="font-headline text-base font-semibold uppercase tracking-[0.15em] text-on-surface">
              {title}
            </h3>
            {description && (
              <p className="mt-1 font-body text-xs text-secondary">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center text-secondary transition-colors duration-300 ease-editorial hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              close
            </span>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-outline-variant/15 bg-surface-container-low/40 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void | Promise<void>;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: 'default' | 'danger';
  readonly busy?: boolean;
}

export function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary transition-colors hover:text-on-surface disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            disabled={busy}
            className={
              'atelier-shadow-sm px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50 ' +
              (tone === 'danger'
                ? 'bg-[#c62828] text-white'
                : 'bg-inverse-surface text-inverse-on-surface')
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="font-body text-sm text-on-surface">{message}</p>
    </Modal>
  );
}
