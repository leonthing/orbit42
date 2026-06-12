"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/account";
import { PendingButton } from "@/components/PendingButton";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg-base))] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40 p-6 shadow-xl">
        <h1 className="text-lg font-bold text-charcoal-100">비밀번호 재설정</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          가입한 이메일을 입력하시면 재설정 링크를 보내드려요.
        </p>

        {sent ? (
          <p className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
            입력한 이메일이 계정과 연결돼 있다면 재설정 링크가 전송되었어요.
            메일함을 확인해주세요.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className="w-full rounded-md border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
            <PendingButton
              type="submit"
              pending={loading}
              pendingLabel="보내는 중…"
              disabled={!email}
              className="w-full"
            >
              재설정 링크 받기
            </PendingButton>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-charcoal-500">
          <Link href="/" className="text-red-500 hover:underline">
            ← 로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
