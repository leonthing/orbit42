"use client";

import { useState } from "react";
import { login } from "./actions";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-charcoal-200 bg-white shadow-lg dark:border-charcoal-700 dark:bg-charcoal-800/80">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-navy-500 via-navy-600 to-navy-700" />

          <div className="px-8 pb-8 pt-10">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-50 dark:bg-navy-950/50">
              <svg
                className="h-8 w-8 text-navy-600 dark:text-navy-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>

            {/* Title */}
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
                Admin
              </h1>
              <p className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-400">
                관리자 패널에 접속하려면 비밀번호를 입력하세요
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
                  비밀번호
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <svg
                      className="h-4 w-4 text-charcoal-400 dark:text-charcoal-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
                      />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full rounded-xl border border-charcoal-300 bg-charcoal-50 py-3 pl-10 pr-4 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 dark:bg-red-950/30">
                  <svg
                    className="h-4 w-4 shrink-0 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="relative w-full overflow-hidden rounded-xl bg-navy-600 px-4 py-3 font-medium text-white shadow-sm transition-all hover:bg-navy-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
              >
                <span className={loading ? "invisible" : ""}>로그인</span>
                {loading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="h-5 w-5 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-charcoal-400 dark:text-charcoal-500">
          Orbit42 Admin Panel
        </p>
      </div>
    </div>
  );
}
