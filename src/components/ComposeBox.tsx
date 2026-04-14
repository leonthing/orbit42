"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createFeedPost } from "@/lib/feed-posts";

export function ComposeBox({
  viewerName,
  viewerUsername,
  googleConnected,
}: {
  viewerName: string;
  viewerUsername: string;
  googleConnected?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [calendarStart, setCalendarStart] = useState("");
  const [pending, startTransition] = useTransition();

  const initial = (viewerName || viewerUsername).charAt(0).toUpperCase();
  const remaining = 1000 - body.length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    const fd = new FormData();
    fd.set("body", body);
    if (location) fd.set("location", location);
    if (addToCalendar) {
      fd.set("add_to_calendar", "1");
      if (calendarStart) fd.set("calendar_start", new Date(calendarStart).toISOString());
    }
    for (const f of files) fd.append("images", f);
    startTransition(async () => {
      const res = (await createFeedPost(fd)) as {
        error?: string;
        success?: boolean;
        warn?: string;
      };
      if (res.error) return alert(res.error);
      if (res.warn) alert(res.warn);
      setBody("");
      setFiles([]);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews([]);
      setLocation("");
      setShowLocation(false);
      setAddToCalendar(false);
      setCalendarStart("");
      formRef.current?.reset();
      router.refresh();
    });
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, 4 - files.length);
    if (picked.length === 0) return;
    const next = [...files, ...picked].slice(0, 4);
    setFiles(next);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-4"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-600/40 to-amber-500/30 text-sm font-bold text-charcoal-100">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="지금 무엇을 하고 있나요?"
            rows={2}
            maxLength={1000}
            className="w-full resize-none border-0 bg-transparent text-base text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-0"
          />

          {previews.length > 0 && (
            <div
              className={`mt-2 grid gap-2 ${
                previews.length === 1
                  ? "grid-cols-1"
                  : previews.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-2"
              }`}
            >
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-xl border border-charcoal-800/60"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 rounded-full bg-charcoal-900/80 px-2 py-0.5 text-xs text-charcoal-100 hover:bg-charcoal-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLocation && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2">
              <span className="text-charcoal-500">📍</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="위치 (예: 성수동 카페)"
                className="flex-1 border-0 bg-transparent text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => {
                  setShowLocation(false);
                  setLocation("");
                }}
                className="text-xs text-charcoal-500 hover:text-charcoal-300"
              >
                ✕
              </button>
            </div>
          )}

          {addToCalendar && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
              <span className="text-amber-400">📅</span>
              <input
                type="datetime-local"
                value={calendarStart}
                onChange={(e) => setCalendarStart(e.target.value)}
                className="flex-1 border-0 bg-transparent text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none focus:ring-0"
              />
              <span className="text-[10px] text-charcoal-500">
                비워두면 지금 시각 · 30분 일정
              </span>
              <button
                type="button"
                onClick={() => {
                  setAddToCalendar(false);
                  setCalendarStart("");
                }}
                className="text-xs text-charcoal-500 hover:text-charcoal-300"
              >
                ✕
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-charcoal-800/40 pt-3">
            <div className="flex items-center gap-1">
              <ToolButton
                onClick={() => fileRef.current?.click()}
                label="사진"
                icon="🖼️"
                disabled={files.length >= 4}
              />
              <ToolButton
                onClick={() => setShowLocation((s) => !s)}
                label="위치"
                icon="📍"
                active={showLocation}
              />
              <ToolButton
                onClick={() => {
                  if (!googleConnected) {
                    alert("Google Calendar를 먼저 연결해주세요.");
                    return;
                  }
                  setAddToCalendar((s) => !s);
                }}
                label="캘린더에 추가"
                icon="📅"
                active={addToCalendar}
                disabled={!googleConnected}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPickFiles}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs ${remaining < 50 ? "text-amber-400" : "text-charcoal-600"}`}
              >
                {remaining}
              </span>
              <button
                type="submit"
                disabled={pending || (!body.trim() && files.length === 0)}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-charcoal-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "올리는 중…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function ToolButton({
  onClick,
  label,
  icon,
  active,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${
        active
          ? "bg-amber-500/20 text-amber-300"
          : "text-charcoal-400 hover:bg-charcoal-800/60 hover:text-charcoal-200"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {icon}
    </button>
  );
}
