import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-charcoal-800 disabled:text-charcoal-500",
  secondary:
    "border border-charcoal-800/60 bg-charcoal-900/40 text-charcoal-200 hover:border-charcoal-700 hover:text-white disabled:opacity-50",
  danger:
    "border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50",
  ghost:
    "text-charcoal-300 hover:bg-charcoal-800/50 hover:text-white disabled:opacity-50",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "rounded-md px-2.5 py-1 text-xs font-medium",
  md: "rounded-lg px-4 py-2 text-sm font-semibold",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
};

/**
 * Unified form/action button. Shows a spinner + `pendingLabel` while
 * `pending` is true, and stays disabled. Variants cover the common
 * primary / secondary / danger / ghost patterns so callers stop
 * hand-rolling Tailwind strings.
 */
export function PendingButton({
  pending = false,
  pendingLabel,
  variant = "primary",
  size = "md",
  leading,
  children,
  disabled,
  className = "",
  ...rest
}: Props) {
  const isDisabled = disabled || pending;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors disabled:cursor-not-allowed ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
    >
      {pending ? (
        <Spinner />
      ) : leading ? (
        <span className="shrink-0">{leading}</span>
      ) : null}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
