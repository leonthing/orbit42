"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { STORY_TEMPLATES } from "@/lib/story-templates";

/**
 * 인스타 스토리용 이미지 — 템플릿을 고르고, 모바일이면 공유 시트로 바로 보내고
 * (인스타 → 스토리), 아니면 내려받는다. 인스타는 외부에서 링크 스티커를 붙일 수
 * 없어서, 공유할 때 링크를 클립보드에 넣어 두고 스티커에 붙여넣게 안내한다.
 */
export function StoryShareButton({
  imagePath,
  linkUrl,
  fileName,
  className,
  label = "스토리 이미지",
}: {
  /** 예: /api/story/{username}/{slug} 또는 /api/story/{username} */
  imagePath: string;
  linkUrl: string;
  fileName: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? buttonClasses({ variant: "secondary", size: "sm" })} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <StoryShareModal imagePath={imagePath} linkUrl={linkUrl} fileName={fileName} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

function StoryShareModal({
  imagePath,
  linkUrl,
  fileName,
  onClose,
}: {
  imagePath: string;
  linkUrl: string;
  fileName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [tpl, setTpl] = useState(STORY_TEMPLATES[0].key);
  const [busy, setBusy] = useState(false);
  const src = `${imagePath}?t=${tpl}`;

  const share = async () => {
    setBusy(true);
    try {
      try {
        await navigator.clipboard.writeText(linkUrl);
      } catch {
        /* 클립보드 권한이 없으면 건너뛴다 */
      }
      const blob = await fetch(src).then((r) => r.blob());
      const file = new File([blob], `${fileName}-${tpl}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file] });
        toast.success("링크를 복사했어요", "인스타 스토리에서 링크 스티커에 붙여넣으세요.");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("이미지를 저장했어요", "링크도 복사해 뒀어요 — 스토리의 링크 스티커에 붙여넣으세요.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-[rgb(var(--bg-surface))] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-charcoal-50">인스타 스토리용 이미지</p>
          <button type="button" onClick={onClose} className="text-sm text-charcoal-500 hover:text-charcoal-200">
            닫기
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt="스토리 이미지 미리보기"
          className="mx-auto aspect-[9/16] w-full max-w-[240px] rounded-xl bg-charcoal-800/40 object-cover shadow-lg"
        />
        <div className="flex justify-center gap-2">
          {STORY_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTpl(t.key)}
              aria-label={t.label}
              title={t.label}
              className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-[rgb(var(--bg-surface))] transition ${
                tpl === t.key ? "ring-2 ring-navy-500" : ""
              }`}
              style={{ background: `linear-gradient(180deg, ${t.from}, ${t.to})` }}
            />
          ))}
        </div>
        <button type="button" disabled={busy} onClick={share} className={buttonClasses({ size: "lg" })}>
          {busy ? "만드는 중…" : "스토리에 올리기 / 저장"}
        </button>
        <p className="text-center text-2xs leading-relaxed text-charcoal-500">
          휴대폰에서는 공유 시트에서 Instagram → 스토리를 고르세요. 링크는 자동으로 복사돼요 —
          스토리 편집 화면의 링크 스티커에 붙여넣으면 끝이에요.
        </p>
      </div>
    </div>
  );
}
