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
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
          Admin
        </h1>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy-600 px-4 py-2 font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
