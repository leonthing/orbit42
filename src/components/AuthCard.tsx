"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, signup } from "@/lib/auth";

type Mode = "signin" | "signup";

export function AuthCard({ initialMode = "signup" }: { initialMode?: Mode }) {
  return (
    <Suspense fallback={null}>
      <AuthCardInner initialMode={initialMode} />
    </Suspense>
  );
}

function AuthCardInner({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A referrer's username can arrive via ?ref=@leo or ?ref=leo.
  const urlRef = (searchParams.get("ref") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const urlMode = searchParams.get("mode");
  const justReset = searchParams.get("reset") === "1";
  const [mode, setMode] = useState<Mode>(
    urlRef
      ? "signup"
      : urlMode === "signin" || urlMode === "signup"
        ? urlMode
        : initialMode,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [referrerRef, setReferrerRef] = useState(urlRef);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Collapsible on mobile to save vertical space. Expanded by default
  // on desktop (md+ via CSS), or when the visitor came in with an
  // explicit intent (?mode=, ?ref=, or ?reset=).
  const cameWithIntent =
    urlMode === "signin" ||
    urlMode === "signup" ||
    !!urlRef ||
    justReset;
  const [expanded, setExpanded] = useState(cameWithIntent);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // When the visitor lands here directly via /?mode=..., pull the card
    // into view — on mobile the hero sits above it.
    if (urlMode === "signin" || urlMode === "signup") {
      rootRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [urlMode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }
    setLoading(true);
    const res =
      mode === "signin"
        ? await login(username, password)
        : await signup(username, password, email, displayName || undefined, referrerRef || undefined);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/feed");
  };

  const input =
    "w-full rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/40";

  return (
    <div
      ref={rootRef}
      id="auth"
      className="mx-auto w-full max-w-sm rounded-xl border border-charcoal-800/60 bg-charcoal-900/50 p-4 shadow-xl backdrop-blur sm:p-5"
    >
      {/* Collapsed trigger — mobile only, only when !expanded. */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between rounded-lg bg-navy-500/10 px-3 py-2 text-sm font-semibold text-navy-300 hover:bg-navy-500/20 md:hidden"
        >
          <span>로그인 · 가입하기</span>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}

      <div className={expanded ? "block" : "hidden md:block"}>
      {justReset && mode === "signin" && (
        <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-2xs text-emerald-700 dark:text-emerald-200">
          비밀번호가 변경되었어요. 새 비밀번호로 로그인해주세요.
        </div>
      )}
      <div className="mb-3 flex items-center gap-1.5">
        <div className="flex flex-1 rounded-lg bg-charcoal-800/40 p-0.5">
          <TabButton
            active={mode === "signin"}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            로그인
          </TabButton>
          <TabButton
            active={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            가입
          </TabButton>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-lg px-2 py-1 text-2xs text-charcoal-500 hover:text-charcoal-200 md:hidden"
          title="접기"
        >
          접기
        </button>
      </div>

      <a
        href={
          mode === "signup" && referrerRef
            ? `/api/auth/google?ref=${encodeURIComponent(referrerRef)}`
            : "/api/auth/google"
        }
        className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f1f1f] ring-1 ring-black/5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#fbbc04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google로 계속하기
      </a>

      <div className="mb-2.5 flex items-center gap-2 text-2xs uppercase tracking-wider text-charcoal-500">
        <span className="h-px flex-1 bg-charcoal-800/60" />
        <span>또는</span>
        <span className="h-px flex-1 bg-charcoal-800/60" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        {mode === "signup" && (
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className={input}
            required
          />
        )}
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
          placeholder={mode === "signup" ? "아이디 (영문 소문자·숫자)" : "아이디"}
          className={input}
          required
        />
        {mode === "signup" && (
          <p className="-mt-0.5 text-2xs text-charcoal-500">
            {username ? (
              <>
                orbit42.org/<span className="text-navy-400">{username}</span>
              </>
            ) : (
              "영문 소문자·숫자만 사용할 수 있어요."
            )}
          </p>
        )}
        {mode === "signup" && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="표시 이름 (선택)"
            className={input}
          />
        )}
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "비밀번호 (6자 이상)" : "비밀번호"}
          className={input}
          required
        />
        {mode === "signup" && (
          <input
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            className={input}
            required
          />
        )}
        {mode === "signup" && (
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
            className={input}
            maxLength={32}
          />
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="!mt-3 w-full rounded-lg bg-navy-500 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-400 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
        >
          {loading
            ? "처리 중…"
            : mode === "signup"
              ? "계정 만들기"
              : "로그인"}
        </button>
      </form>

      <p className="mt-3 text-center text-2xs text-charcoal-500">
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
      className={`flex-1 rounded-sm px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "bg-navy-500 text-white shadow-sm"
          : "text-charcoal-500 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-100"
      }`}
    >
      {children}
    </button>
  );
}
