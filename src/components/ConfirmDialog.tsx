"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { buttonClasses } from "@/components/PendingButton";

type Options = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button as destructive (red). */
  danger?: boolean;
};

type Ctx = (opts: Options) => Promise<boolean>;

const Ctx = createContext<Ctx | null>(null);

/**
 * Imperative confirm dialog — replacement for window.confirm().
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "삭제할까요?", danger: true })) { ... }
 */
export function useConfirm(): Ctx {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback during SSR/edge renders.
    return async () => false;
  }
  return v;
}

type Pending = {
  opts: Options;
  resolve: (ok: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Ctx>(async (opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const resolve = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  // Escape cancels the dialog (parity with clicking the backdrop / 취소).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        pending.resolve(false);
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => resolve(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-charcoal-100">
              {pending.opts.title}
            </h3>
            {pending.opts.body && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-charcoal-400">
                {pending.opts.body}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus={pending.opts.danger}
                onClick={() => resolve(false)}
                className={buttonClasses({ variant: "secondary" })}
              >
                {pending.opts.cancelLabel ?? "취소"}
              </button>
              <button
                type="button"
                autoFocus={!pending.opts.danger}
                onClick={() => resolve(true)}
                className={buttonClasses({
                  variant: pending.opts.danger ? "danger" : "primary",
                })}
              >
                {pending.opts.confirmLabel ?? "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
