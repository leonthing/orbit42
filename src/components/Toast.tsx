"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional secondary line (e.g. a hint). */
  body?: string;
};

type ToastCtx = {
  success: (message: string, body?: string) => void;
  error: (message: string, body?: string) => void;
  info: (message: string, body?: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Graceful fallback — never throw in case a component renders
    // outside the provider. In practice the provider is mounted at
    // the root so this branch is only for SSR/prerender safety.
    const noop = () => {};
    return { success: noop, error: noop, info: noop };
  }
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((arr) => arr.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, body?: string) => {
      const id = ++seq.current;
      setItems((arr) => [...arr, { id, kind, message, body }]);
      const timeout = kind === "error" ? 6000 : 3500;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), timeout),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const api: ToastCtx = {
    success: (m, b) => push("success", m, b),
    error: (m, b) => push("error", m, b),
    info: (m, b) => push("info", m, b),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:items-end sm:pb-0"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const color =
    item.kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : item.kind === "error"
        ? "border-red-500/50 bg-red-500/10 text-red-100"
        : "border-charcoal-700 bg-charcoal-900/90 text-charcoal-100";
  return (
    <div
      role="status"
      className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-xl backdrop-blur transition-all sm:w-auto sm:min-w-[280px] ${color}`}
    >
      <div className="flex items-start gap-2">
        <Icon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.message}</p>
          {item.body && (
            <p className="mt-0.5 text-2xs leading-snug opacity-80">
              {item.body}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-mr-1 shrink-0 rounded p-0.5 text-xs opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function Icon({ kind }: { kind: ToastKind }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (kind === "success")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  if (kind === "error")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    );
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}
