"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LINK_THEMES } from "@/lib/link-themes";
import { updateLinkTheme } from "./link-theme-actions";
import { useToast } from "@/components/Toast";

/**
 * 공개 프로필(링크 페이지) 테마 선택 — SNS 바이오에 걸어둘 때
 * 크리에이터가 자기 브랜드 톤에 맞춰 고른다.
 */
export function LinkThemePicker({
  username,
  current,
}: {
  username: string;
  current: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState(current ?? "default");
  const [pending, startTransition] = useTransition();

  const pick = (key: string) => {
    setSelected(key);
    startTransition(async () => {
      const result = await updateLinkTheme(key);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("테마를 저장했어요");
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))]">
      <div className="border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-100">공개 프로필 테마</h2>
        <p className="mt-0.5 text-xs text-charcoal-500">
          SNS에 걸어두는 내 링크 페이지({`orbit42.org/${username}`})의 색이에요.
          방문자에게는 항상 이 색으로 보여요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {LINK_THEMES.map((theme) => (
          <button
            key={theme.key}
            type="button"
            onClick={() => pick(theme.key)}
            disabled={pending}
            className={`overflow-hidden rounded-xl border transition-all ${
              selected === theme.key
                ? "border-navy-500 ring-2 ring-navy-500/30"
                : "border-charcoal-800/60 hover:border-charcoal-700"
            } disabled:opacity-60`}
          >
            {/* 미리보기 */}
            <span
              className="flex h-20 flex-col items-center justify-center gap-1.5"
              style={{ background: theme.background }}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: theme.surface }}
              />
              <span
                className="h-2 w-12 rounded-full"
                style={{ backgroundColor: theme.surface }}
              />
              <span
                className="h-3 w-10 rounded-full"
                style={{ backgroundColor: theme.accent }}
              />
            </span>
            <span className="block py-2 text-xs font-medium text-charcoal-300">
              {theme.label}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-charcoal-800/40 px-5 py-3">
        <a
          href={`/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-navy-400 hover:text-navy-300"
        >
          내 링크 페이지 미리보기 →
        </a>
      </div>
    </section>
  );
}
