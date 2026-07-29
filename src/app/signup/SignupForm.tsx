"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/auth";
import { PendingButton } from "@/components/PendingButton";

export function SignupForm({ initialRef }: { initialRef: string }) {
  const router = useRouter();
  const [referrerRef, setReferrerRef] = useState(initialRef);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }
    setLoading(true);
    const res = await signup(
      username,
      password,
      email,
      displayName || undefined,
      referrerRef || undefined,
    );
    if ("error" in res && res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/feed");
  };

  const input =
    "w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2.5 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/40";

  return (
    <>
      <a
        href={
          referrerRef
            ? `/api/auth/google?ref=${encodeURIComponent(referrerRef)}`
            : "/api/auth/google"
        }
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#111] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f1f1f] ring-1 ring-black/5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#fbbc04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google로 계속하기
      </a>

      <div className="mb-3 flex items-center gap-2 text-2xs uppercase tracking-wider text-charcoal-500">
        <span className="h-px flex-1 bg-charcoal-800/60" />
        <span>또는</span>
        <span className="h-px flex-1 bg-charcoal-800/60" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          className={input}
          autoFocus={!initialRef}
        />
        <input
          type="text"
          value={username}
          onChange={(e) =>
            setUsername(
              e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
            )
          }
          placeholder="아이디 (영문 소문자·숫자)"
          required
          className={input}
        />
        <p className="-mt-1 text-2xs text-charcoal-500">
          {username ? (
            <>
              orbit42.org/<span className="text-navy-400">{username}</span>
            </>
          ) : (
            "영문 소문자·숫자만 사용할 수 있어요."
          )}
        </p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="표시 이름 (선택)"
          className={input}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          required
          className={input}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="비밀번호 확인"
          required
          className={input}
        />
        <input
          type="text"
          value={referrerRef}
          onChange={(e) =>
            setReferrerRef(
              e.target.value
                .trim()
                .replace(/^@/, "")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, ""),
            )
          }
          placeholder="추천인 @username (선택)"
          maxLength={32}
          className={input}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <PendingButton
          type="submit"
          pending={loading}
          pendingLabel="가입 중…"
          disabled={!username || !password}
          className="!mt-3 w-full"
        >
          가입하기
        </PendingButton>
      </form>
    </>
  );
}
