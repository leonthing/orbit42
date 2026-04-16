"use client";

import { useState } from "react";
import type { InviteCode } from "@/lib/invite";

export function InviteCodes({ codes: initial }: { codes: InviteCode[] }) {
  const [codes] = useState(initial);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const available = codes.filter((c) => !c.used_by_username);
  const used = codes.filter((c) => !!c.used_by_username);

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <h2 className="mb-1 text-sm font-semibold text-charcoal-200">
        초대 코드
      </h2>
      <p className="mb-4 text-xs text-charcoal-500">
        {available.length}개 남음 · 코드를 공유하면 상대방이 가입할 수 있어요
      </p>

      {available.length > 0 && (
        <div className="mb-4 space-y-2">
          {available.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 px-4 py-2.5"
            >
              <span className="font-mono text-sm font-bold tracking-wider text-charcoal-100">
                {c.code}
              </span>
              <button
                type="button"
                onClick={() => copy(c.code)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-charcoal-400 hover:bg-charcoal-700/50 hover:text-charcoal-200"
              >
                {copied === c.code ? "복사됨" : "복사"}
              </button>
            </div>
          ))}
        </div>
      )}

      {used.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-500">
            사용됨
          </p>
          {used.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg px-4 py-2 text-xs text-charcoal-500"
            >
              <span className="font-mono line-through">{c.code}</span>
              <span>@{c.used_by_username}</span>
            </div>
          ))}
        </div>
      )}

      {codes.length === 0 && (
        <p className="text-xs text-charcoal-500">
          아직 초대 코드가 없어요.
        </p>
      )}
    </div>
  );
}
