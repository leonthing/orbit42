"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/PendingButton";

type Props = {
  url: string;
  title: string;
  text?: string;
  /** Small variant — icon-only button for dense card UIs. */
  compact?: boolean;
};

type Target = "x" | "facebook" | "linkedin" | "instagram" | "copy";

export function ShareMenu({ url, title, text, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Target | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const share = async () => {
    // Native mobile share sheet covers every app — preferable when we have it.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        // text 를 함께 넘기면 메시지·메모·카톡 등 상당수 대상이 본문과 URL 을
        // 이어 붙여 준다. 그러면 "…예약해보세요\nhttps://orbit42.org/…" 가
        // 통째로 붙여넣어져 주소창에서 404 가 난다. 링크 미리보기 문구는
        // 대상 페이지의 OG 태그가 담당하므로 여기서는 url·title 만 넘긴다.
        await navigator.share({ url, title });
        return;
      } catch {
        // User cancelled or share failed — fall through to menu.
      }
    }
    setOpen((v) => !v);
  };

  const composed = text ? `${text}\n${url}` : url;

  const openUrl = (target: Target) => {
    const enc = encodeURIComponent;
    const textEnc = enc(text ?? title);
    const urlEnc = enc(url);
    let href: string | null = null;
    if (target === "x") href = `https://x.com/intent/post?text=${textEnc}&url=${urlEnc}`;
    else if (target === "facebook")
      href = `https://www.facebook.com/sharer/sharer.php?u=${urlEnc}`;
    else if (target === "linkedin")
      href = `https://www.linkedin.com/sharing/share-offsite/?url=${urlEnc}`;
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const copy = async (target: Target) => {
    try {
      await navigator.clipboard.writeText(target === "instagram" ? composed : url);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // fallback: prompt
      prompt("링크를 복사해주세요", url);
    }
  };

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={share}
        className={buttonClasses({ variant: "secondary", iconOnly: compact })}
        aria-label="공유"
        title="공유"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
          />
        </svg>
        {!compact && <span>공유</span>}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] shadow-xl">
          <ul className="divide-y divide-charcoal-800/40">
            <li>
              <button
                type="button"
                onClick={() => copy("copy")}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/40"
              >
                <span className="flex items-center gap-2.5">
                  <Icon kind="link" />
                  링크 복사
                </span>
                {copied === "copy" && (
                  <span className="text-2xs text-emerald-400">복사됨</span>
                )}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => openUrl("x")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/40"
              >
                <Icon kind="x" />X (트위터)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => openUrl("facebook")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/40"
              >
                <Icon kind="facebook" />
                Facebook
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => openUrl("linkedin")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/40"
              >
                <Icon kind="linkedin" />
                LinkedIn
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => copy("instagram")}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-charcoal-200 hover:bg-charcoal-800/40"
              >
                <span className="flex items-center gap-2.5">
                  <Icon kind="instagram" />
                  Instagram (복사)
                </span>
                {copied === "instagram" && (
                  <span className="text-2xs text-emerald-400">복사됨</span>
                )}
              </button>
            </li>
          </ul>
          <div className="border-t border-charcoal-800/40 px-3.5 py-2 text-2xs text-charcoal-600">
            Instagram 은 링크 공유 API 가 없어, 복사한 뒤 스토리/DM/바이오에 붙여
            주세요.
          </div>
        </div>
      )}
    </div>
  );
}

function Icon({ kind }: { kind: "link" | "x" | "facebook" | "linkedin" | "instagram" }) {
  const cls = "h-4 w-4";
  if (kind === "link")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    );
  if (kind === "x")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.244 2H21.5l-7.43 8.49L22.5 22h-6.82l-5.34-6.98L4.29 22H1.03l7.94-9.08L1.5 2h6.97l4.82 6.38L18.244 2Zm-1.2 18.04h1.88L6.99 3.86H5L17.04 20.04Z" />
      </svg>
    );
  if (kind === "facebook")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.26-1.55 1.58-1.55H16.7V4.25c-.3-.04-1.35-.13-2.58-.13-2.55 0-4.29 1.56-4.29 4.42v2.25H7v3.2h2.83V22h3.67Z" />
      </svg>
    );
  if (kind === "linkedin")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75ZM10 9.75h3.8v1.55h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.74 2.63 4.74 6.05V21h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75V21h-4V9.75Z" />
      </svg>
    );
  // instagram
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
