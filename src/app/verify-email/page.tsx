import Link from "next/link";
import { verifyEmail } from "@/lib/account";
import { buttonClasses } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  const result = token
    ? await verifyEmail(token)
    : { error: "토큰이 없어요." };
  const ok = "success" in result;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg-base))] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 p-8 text-center shadow-xl">
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            ok
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-navy-400/15 text-navy-600 dark:text-navy-300"
          }`}
        >
          {ok ? "✓" : "!"}
        </div>
        <h1 className="text-lg font-bold text-charcoal-100">
          {ok ? "이메일 확인 완료" : "이메일 확인 실패"}
        </h1>
        <p className="mt-1.5 text-sm text-charcoal-500">
          {ok ? "이제 모든 기능을 사용할 수 있어요." : "error" in result ? result.error : ""}
        </p>
        <Link href={ok ? "/feed" : "/"} className={`mt-6 ${buttonClasses()}`}>
          {ok ? "피드로 이동" : "홈으로"}
        </Link>
      </div>
    </div>
  );
}
