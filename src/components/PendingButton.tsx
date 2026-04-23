import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-charcoal-800 disabled:text-charcoal-500",
  secondary:
    "border border-charcoal-700/60 bg-charcoal-800/40 text-charcoal-200 hover:border-charcoal-600 hover:bg-charcoal-800 hover:text-white disabled:opacity-50",
  danger:
    "border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50",
  ghost:
    "text-charcoal-300 hover:bg-charcoal-800/50 hover:text-white disabled:opacity-50",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-3 text-xs font-medium",
  md: "h-9 rounded-lg px-4 text-sm font-semibold",
  lg: "h-11 rounded-lg px-5 text-sm font-semibold",
};

const ICON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-11 w-11 rounded-lg",
};

const BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1.5 transition-colors disabled:cursor-not-allowed";

export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
} = {}) {
  const sizeClass = iconOnly ? ICON_SIZE_CLASS[size] : SIZE_CLASS[size];
  return `${BASE_CLASS} ${sizeClass} ${VARIANT_CLASS[variant]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  leading?: ReactNode;
};

export function PendingButton({
  pending = false,
  pendingLabel,
  variant = "primary",
  size = "md",
  iconOnly = false,
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
      className={`${buttonClasses({ variant, size, iconOnly })} ${className}`}
    >
      {pending ? (
        <Spinner />
      ) : leading ? (
        <span className="shrink-0">{leading}</span>
      ) : null}
      {iconOnly ? null : (
        <span>{pending && pendingLabel ? pendingLabel : children}</span>
      )}
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
