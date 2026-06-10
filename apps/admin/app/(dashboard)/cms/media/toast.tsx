'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
}

interface ToastContextValue {
  readonly push: (tone: ToastTone, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${
              t.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100'
                : t.tone === 'error'
                ? 'border-rose-500/30 bg-rose-950/90 text-rose-100'
                : 'border-outline-variant/30 bg-surface-container/90 text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {t.tone === 'success' ? 'check_circle' : t.tone === 'error' ? 'error' : 'info'}
            </span>
            <span className="font-body text-sm">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}
