"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/PendingButton";
import { issueIntegrationToken, revokeIntegrationToken } from "./pat-actions";

type Row = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** 연동 토큰 — 외부 도구(예: 업무 비서)가 일정·예약을 읽고 완료 체크만 할 수 있는 토큰. */
export function IntegrationTokens({ initial }: { initial: Row[] }) {
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = initial.filter((t) => !t.revoked_at);

  const issue = () => {
    setError(null);
    startTransition(async () => {
      const res = await issueIntegrationToken(name);
      if ("error" in res && res.error) setError(res.error);
      else if ("token" in res && res.token) {
        setIssued(res.token);
        setName("");
      }
    });
  };

  const revoke = (id: string, label: string) => {
    if (!confirm(`'${label}' 토큰을 폐기할까요? 이 토큰을 쓰는 도구는 바로 끊겨요.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeIntegrationToken(id);
      if ("error" in res && res.error) setError(res.error);
    });
  };

  const copy = async () => {
    if (!issued) return;
    await navigator.clipboard.writeText(issued);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <h2 className="mb-1 text-sm font-semibold text-charcoal-200">연동 토큰</h2>
      <p className="mb-4 text-xs text-charcoal-500">
        외부 도구가 내 일정·예약을 읽고 일정 완료 체크만 할 수 있는 토큰이에요. 일정을 만들거나
        지우는 등 다른 일은 할 수 없어요. 필요 없어지면 바로 폐기하세요.
      </p>

      {issued ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-2 text-xs text-amber-500">
            지금 한 번만 보여요. 복사해서 쓸 곳에 저장한 뒤 닫으세요. 남에게 보내지 마세요.
          </p>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-charcoal-200">
              {issued.slice(0, 12)}••••••••
            </span>
            <button type="button" onClick={copy} className={buttonClasses({ size: "sm" })}>
              {copied ? "복사됨" : "복사"}
            </button>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className={buttonClasses({ size: "sm", variant: "ghost" })}
            >
              닫기
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (예: CEO 세션)"
            maxLength={60}
            className="min-w-0 flex-1 rounded-lg border border-charcoal-800/60 bg-charcoal-800/20 px-3 py-2 text-sm text-charcoal-100"
          />
          <button
            type="button"
            onClick={issue}
            disabled={pending || !name.trim()}
            className={buttonClasses({ size: "sm" })}
          >
            발급
          </button>
        </div>
      )}

      {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}

      {active.length > 0 && (
        <ul className="divide-y divide-charcoal-800/40 text-sm">
          {active.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-charcoal-200">{t.name}</p>
                <p className="text-2xs text-charcoal-500">
                  발급 {fmt(t.created_at)} · 마지막 사용 {fmt(t.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(t.id, t.name)}
                disabled={pending}
                className="text-xs text-red-500 hover:underline"
              >
                폐기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
