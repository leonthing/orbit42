"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { uploadAvatar } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { resizeImageToJpeg } from "@/lib/image-resize";

/**
 * Avatar with an Instagram-style "+" quick-upload overlay for the owner.
 * On pick → resize → uploadAvatar → router.refresh(). Non-owners get a
 * plain Avatar.
 */
export function ProfileAvatar({
  url,
  name,
  size,
  editable,
}: {
  url: string | null;
  name: string;
  size: number;
  editable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return <Avatar url={url} name={name} size={size} />;
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    startTransition(async () => {
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
      toast.success("프로필 사진이 바뀌었어요.");
      router.refresh();
    });
  };

  // Badge size scales with avatar — ~25% but with a floor.
  const badge = Math.max(20, Math.round(size * 0.3));

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label="프로필 사진 변경"
        className="group block rounded-full focus:outline-none focus:ring-2 focus:ring-red-500/50"
      >
        <Avatar url={url} name={name} size={size} />
        <span
          className={`pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-[rgb(var(--bg-base))] bg-red-600 text-white shadow transition-transform group-hover:scale-110 ${
            pending ? "opacity-60" : ""
          }`}
          style={{
            width: badge,
            height: badge,
            right: -2,
            bottom: -2,
          }}
        >
          {pending ? (
            <svg
              className="animate-spin"
              width={badge * 0.55}
              height={badge * 0.55}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width={badge * 0.6}
              height={badge * 0.6}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={3}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </span>
  );
}
