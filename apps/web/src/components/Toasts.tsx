import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastInput {
  message: string;
  tone?: 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastApi {
  showToast(t: ToastInput): void;
  /** Runs the newest toast's action (Undo) if one is showing. For ⌘/Ctrl-Z. */
  undoLast(): boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const current = useRef<Toast[]>([]);
  useEffect(() => {
    current.current = toasts;
  }, [toasts]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const showToast = useCallback(
    ({ durationMs = 8000, tone = 'info', ...rest }: ToastInput) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, tone, ...rest }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const undoLast = useCallback(() => {
    const last = [...current.current].reverse().find((t) => t.onAction && t.actionLabel);
    if (!last) return false;
    last.onAction?.();
    dismiss(last.id);
    return true;
  }, [dismiss]);

  const value = useMemo(() => ({ showToast, undoLast }), [showToast, undoLast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span>{t.message}</span>
            {t.actionLabel && t.onAction ? (
              <button
                type="button"
                className="btn btn--small btn--inverse"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            ) : null}
            <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
