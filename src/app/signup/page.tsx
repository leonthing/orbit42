"use client";

import { useState } from "react";
import { signup } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signup(username, password, displayName || undefined);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/${result.username}/dashboard`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg-base))]">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-charcoal-800 bg-charcoal-900/60 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-navy-600/20">
              <svg className="h-7 w-7 text-navy-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-charcoal-100">Sign Up</h1>
            <p className="mt-1 text-sm text-charcoal-500">Orbit42 계정 만들기</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="Username (영문 소문자, 숫자)"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
                autoFocus
              />
              {username && (
                <p className="mt-1.5 text-xs text-charcoal-500">
                  orbit42.org/<span className="text-navy-400">{username}</span>
                </p>
              )}
            </div>
            <div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name (선택)"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (6자 이상)"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-3 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-lg bg-navy-600 py-3 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="mx-auto h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-navy-400 hover:text-navy-300">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
