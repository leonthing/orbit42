"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { SITE } from "@/lib/constants";
import { checkInOptions, checkInWithLink } from "@/lib/check-in-messages";

type Person = { id: string; name: string; daysSince: number | null; lastMeetingTitle: string | null };

/**
 * 안부 보내기 — 문구를 고르면 공유 시트(모바일)로 보내거나, 없으면 복사한다.
 * children 이 버튼 모양이고, 누르면 문구 목록이 아래에 뜬다.
 */
export function CheckInButton({
  person,
  username,
  className,
  children,
}: {
  person: Person;
  username: string;
  className?: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const send = async (text: string) => {
    setOpen(false);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("복사했어요. 메신저에 붙여넣어 보내세요.");
    } catch {
      toast.error("복사하지 못했어요.");
    }
  };

  const options = open ? checkInOptions(person) : [];
  const withLink = open ? checkInWithLink(person, `${SITE.url}/${username}`) : [];

  return (
    <div ref={ref} className="relative">
      <button type="button" className={className} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {children}
      </button>
      {open && (
        // 모바일: 하단 탭 위에 화면 폭으로 / 넓은 화면: 버튼 아래 팝오버
        <div className="fixed inset-x-4 bottom-24 z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:w-80">
          <p className="px-4 pb-1 pt-3 text-2xs font-semibold text-charcoal-500">보낼 문구를 골라요</p>
          {options.map((t) => (
            <button key={t} type="button" onClick={() => send(t)} className="block w-full px-4 py-2.5 text-left text-sm text-charcoal-100 hover:bg-charcoal-800/40">
              {t}
            </button>
          ))}
          <p className="border-t border-charcoal-800/50 px-4 pb-1 pt-3 text-2xs font-semibold text-charcoal-500">내 예약 링크와 함께</p>
          {withLink.map((t) => (
            <button key={t} type="button" onClick={() => send(t)} className="block w-full px-4 py-2.5 text-left text-sm text-charcoal-100 hover:bg-charcoal-800/40">
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
