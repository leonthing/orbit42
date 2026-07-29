import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-navy-500 text-white hover:bg-navy-400 disabled:bg-charcoal-800 disabled:text-charcoal-500",
  secondary:
    "border border-charcoal-700/60 bg-charcoal-800/40 text-charcoal-200 hover:border-charcoal-600 hover:bg-charcoal-800 hover:text-white disabled:opacity-50",
  danger:
    "border border-navy-400/50 bg-navy-400/10 text-navy-300 hover:bg-navy-400/20 disabled:opacity-50",
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

// 터치에는 hover 가 없어서 누른 느낌이 전혀 없었다. 살짝 눌리는 스케일과
// 키보드 포커스 링을 공용 클래스에 넣어 이 함수를 쓰는 모든 버튼이 함께 얻는다.
// (모션 축소 설정은 globals.css 에서 전역으로 무력화한다.)
const BASE_CLASS =
  "inline-flex shrink-0 touch-manipulation select-none items-center justify-center gap-1.5 " +
  "transition-[color,background-color,border-color,transform] duration-150 " +
  "active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400/60 " +
  "disabled:cursor-not-allowed disabled:active:scale-100";

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
