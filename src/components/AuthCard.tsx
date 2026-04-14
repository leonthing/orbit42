"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, signup } from "@/lib/auth";

type Mode = "signin" | "signup";

export function AuthCard({ initialMode = "signup" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        : await signup(username, password, displayName || undefined);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/feed");
  };

  const input =
    "w-full rounded-lg border border-charcoal-700 bg-charcoal-900/60 px-4 py-3 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40";

  return (
    <div className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/50 p-5 shadow-2xl backdrop-blur sm:p-6">
      <div className="mb-5 flex rounded-lg bg-charcoal-800/40 p-1">
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

      <form onSubmit={onSubmit} className="space-y-3">
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
          <p className="-mt-1 text-xs text-charcoal-500">
            orbit42.org/<span className="text-red-400">{username}</span>
          </p>
        )}
        {mode === "signup" && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (선택)"
            className={input}
          />
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

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
        >
          {loading
            ? "..."
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-charcoal-500">
        {mode === "signup"
          ? "가입하면 Orbit42의 서비스 약관에 동의하게 됩니다."
          : "비밀번호를 잊으셨나요? 지금은 호스트에게 문의해주세요."}
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
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-red-600 text-white shadow-sm"
          : "text-charcoal-400 hover:text-charcoal-100"
      }`}
    >
      {children}
    </button>
  );
}
