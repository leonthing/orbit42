"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, signup } from "@/lib/auth";

type Mode = "signin" | "signup";

export function AuthCard({ initialMode = "signup" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res =
      mode === "signin"
        ? await login(username, password)
        : await signup(username, password, email, displayName || undefined);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/feed");
  };

  const input =
    "w-full rounded-md border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40";

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-charcoal-800/60 bg-charcoal-900/50 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="mb-3 flex rounded-md bg-charcoal-800/40 p-0.5">
        <TabButton
          active={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setError("");
          }}
        >
          Sign in
        </TabButton>
        <TabButton
          active={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError("");
          }}
        >
          Sign up
        </TabButton>
      </div>

      <a
        href="/api/auth/google"
        className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-[#111] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f1f1f] ring-1 ring-black/5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#fbbc04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </a>

      <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-charcoal-500">
        <span className="h-px flex-1 bg-charcoal-800/60" />
        <span>or</span>
        <span className="h-px flex-1 bg-charcoal-800/60" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            setUsername(
              mode === "signup" ? v.replace(/[^a-z0-9_-]/g, "") : v,
            );
          }}
          placeholder={mode === "signup" ? "Username (영문 소문자, 숫자)" : "Username"}
          className={input}
          required
        />
        {mode === "signup" && username && (
          <p className="-mt-0.5 text-[11px] text-charcoal-500">
            orbit42.org/<span className="text-red-500">{username}</span>
          </p>
        )}
        {mode === "signup" && (
          <>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              className={input}
              required
            />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (선택)"
              className={input}
            />
          </>
        )}
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Password (6자 이상)" : "Password"}
          className={input}
          required
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="!mt-3 w-full rounded-md bg-red-600 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
        >
          {loading
            ? "..."
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-3 text-center text-[11px] text-charcoal-500">
        {mode === "signup" ? (
          <>
            가입하면{" "}
            <Link href="/terms" className="underline hover:text-charcoal-300">
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" className="underline hover:text-charcoal-300">
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </>
        ) : (
          <Link href="/forgot-password" className="hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        )}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[5px] px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "bg-red-600 text-white shadow-sm"
          : "text-charcoal-500 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-100"
      }`}
    >
      {children}
    </button>
  );
}
