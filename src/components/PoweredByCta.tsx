import Link from "next/link";
import { buttonClasses } from "@/components/PendingButton";

/**
 * Footer CTA for logged-out visitors on public slot/booking pages —
 * the booking surface doubles as the product's growth loop.
 */
export function PoweredByCta({ hostUsername }: { hostUsername: string }) {
  return (
    <div className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
        Powered by Orbit42
      </p>
      <p className="mt-2 text-sm text-charcoal-300">
        나도 이런 예약 페이지를 30초 만에 만들 수 있어요.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Link
          href={`/?mode=signup&ref=${encodeURIComponent(hostUsername)}#auth`}
          className={buttonClasses({ size: "sm" })}
        >
          내 시간 열기
        </Link>
        <Link
          href="/explore"
          className="text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          둘러보기
        </Link>
      </div>
    </div>
  );
}
