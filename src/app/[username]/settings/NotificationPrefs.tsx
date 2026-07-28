"use client";

import { useState, useTransition } from "react";
import { setPref } from "@/lib/notification-prefs";
import { NOTIFICATION_TYPES } from "@/lib/notification-prefs-types";
import type { NotificationPref } from "@/lib/notification-prefs-types";

export function NotificationPrefs({
  initial,
}: {
  initial: Record<string, NotificationPref>;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();

  const get = (type: string) =>
    prefs[type] ?? { type, in_app: true, email: true };

  const toggle = (type: string, channel: "in_app" | "email") => {
    const cur = get(type);
    const next = { ...cur, [channel]: !cur[channel] };
    setPrefs((p) => ({ ...p, [type]: next }));
    start(async () => {
      await setPref(type, channel, next[channel]);
    });
  };

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <h2 className="mb-1 text-sm font-semibold text-charcoal-200">
        알림 설정
      </h2>
      <p className="mb-4 text-xs text-charcoal-500">
        인앱 벨 · 이메일 알림을 종류별로 켜고 끌 수 있어요.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-800/40 text-left text-[11px] uppercase tracking-wider text-charcoal-500">
              <th className="px-1 py-2 font-semibold">종류</th>
              <th className="w-24 px-1 py-2 text-center font-semibold">앱 내</th>
              <th className="w-24 px-1 py-2 text-center font-semibold">이메일</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_TYPES.map((t) => {
              const p = get(t.key);
              return (
                <tr
                  key={t.key}
                  className="border-b border-charcoal-800/30 last:border-b-0"
                >
                  <td className="px-1 py-2.5 text-charcoal-200">{t.label}</td>
                  <td className="px-1 py-2.5 text-center">
                    <Toggle
                      on={p.in_app}
                      disabled={pending}
                      onClick={() => toggle(t.key, "in_app")}
                    />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <Toggle
                      on={p.email}
                      disabled={pending}
                      onClick={() => toggle(t.key, "email")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-navy-500" : "bg-charcoal-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}
