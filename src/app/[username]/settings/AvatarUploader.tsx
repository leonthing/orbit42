"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar, clearAvatar } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { resizeImageToJpeg } from "@/lib/image-resize";

export function AvatarUploader({
  initialUrl,
  name,
}: {
  initialUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    startTransition(async () => {
      // Downscale on the client so phone photos don't blow past the
      // server-action body limit — user never sees a "file too big" error.
      const resized = await resizeImageToJpeg(f, {
        maxDimension: 768,
        quality: 0.85,
      });
      const fd = new FormData();
      fd.set("avatar", resized);
      const res = await uploadAvatar(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setUrl(res.url ?? null);
      router.refresh();
    });
  };

  const onClear = async () => {
    const ok = await confirm({
      title: "프로필 사진을 제거할까요?",
      confirmLabel: "제거",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await clearAvatar();
      setUrl(null);
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">프로필 사진</h2>
      </div>
      <div className="flex items-center gap-4 p-5">
        <Avatar url={url} name={name} size={72} />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-red-400 disabled:opacity-60"
            >
              {pending ? "업로드 중…" : url ? "사진 변경" : "사진 올리기"}
            </button>
            {url && (
              <button
                type="button"
                onClick={onClear}
                disabled={pending}
                className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-red-500/60 hover:text-red-400"
              >
                제거
              </button>
            )}
          </div>
          <p className="text-xs text-charcoal-500">
            JPG, PNG, WEBP — 업로드 시 자동으로 줄여드려요.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
      </div>
    </section>
  );
}
