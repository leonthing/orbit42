"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/account";

export default function ResetPasswordPage() {
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
    router.push("/?reset=1");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg-base))] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 p-6 shadow-xl">
        <h1 className="text-lg font-bold text-charcoal-100">새 비밀번호 설정</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          새로 사용할 비밀번호를 입력해주세요.
        </p>

        {!token ? (
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
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
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="새 비밀번호 확인"
              required
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              type="submit"
              disabled={loading || !pw || !confirm}
              className="w-full rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
            >
              {loading ? "변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-charcoal-500">
          <Link href="/" className="text-red-500 hover:underline">
            ← 홈으로
          </Link>
        </p>
      </div>
    </div>
  );
}
