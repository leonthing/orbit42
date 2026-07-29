"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/account";
import { PendingButton } from "@/components/PendingButton";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell>토큰 확인 중…</Shell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("비밀번호는 6자 이상이어야 해요.");
    if (pw !== confirm) return setErr("비밀번호가 일치하지 않아요.");
    setLoading(true);
    const res = await resetPassword(token, pw);
    if (res.error) {
      setErr(res.error);
      setLoading(false);
      return;
    }
    router.push("/login?reset=1");
  };

  return (
    <Shell>
      <h1 className="text-lg font-bold text-charcoal-100">새 비밀번호 설정</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        새로 사용할 비밀번호를 입력해주세요.
      </p>

      {!token ? (
        <p className="mt-6 rounded-lg border border-navy-400/30 bg-navy-400/10 p-4 text-sm text-navy-600 dark:text-navy-200">
          토큰이 없어요. 이메일의 재설정 링크를 통해 다시 접속해주세요.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            required
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/40"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="새 비밀번호 확인"
            required
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/40"
          />
          {err && <p className="text-xs text-navy-400">{err}</p>}
          <PendingButton
            type="submit"
            pending={loading}
            pendingLabel="변경 중…"
            disabled={!pw || !confirm}
            className="w-full"
          >
            비밀번호 변경
          </PendingButton>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-charcoal-500">
        <Link href="/" className="text-navy-400 hover:underline">
          ← 홈으로
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg-base))] px-4">
      <div className="w-full max-w-sm rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}
