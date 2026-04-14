"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createFeedPost } from "@/lib/feed-posts";
import { Avatar } from "@/components/Avatar";

export function ComposeBox({
  viewerName,
  viewerUsername,
  viewerAvatarUrl,
  googleConnected,
}: {
  viewerName: string;
  viewerUsername: string;
  viewerAvatarUrl?: string | null;
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
        <Avatar
          url={viewerAvatarUrl ?? null}
          name={viewerName || viewerUsername}
          size={40}
        />
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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                위치
              </span>
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
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                캘린더
              </span>
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
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                }
                disabled={files.length >= 4}
              />
              <ToolButton
                onClick={() => setShowLocation((s) => !s)}
                label="위치"
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                }
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
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                }
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
                className={`text-xs ${remaining < 50 ? "text-red-400" : "text-charcoal-600"}`}
              >
                {remaining}
              </span>
              <button
                type="submit"
                disabled={pending || (!body.trim() && files.length === 0)}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-charcoal-950 hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
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
  icon: React.ReactNode;
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
          ? "bg-red-500/20 text-red-300"
          : "text-charcoal-400 hover:bg-charcoal-800/60 hover:text-charcoal-200"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {icon}
    </button>
  );
}
