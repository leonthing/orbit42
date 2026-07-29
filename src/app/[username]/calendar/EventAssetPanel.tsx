"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

/**
 * 일정의 자산·기록 부가 정보 — iOS 일정 상세와 같은 구성.
 * 자산 분류(수입/투자/소비/생활) · 수익 기록 · 사진 기록.
 *
 * 이벤트 키는 앱과 같은 형식으로 정규화한다:
 *   주간 뷰 native:<uuid> → <uuid>, <구글캘린더>::<id> → gcal_<id>
 */
const BUCKETS = [
  { key: "earn", label: "수입", color: "#6366f1" },
  { key: "invest", label: "투자", color: "#22c55e" },
  { key: "spend", label: "소비", color: "#f59e0b" },
  { key: "life", label: "생활", color: "#64748b" },
] as const;

function normalizeEventId(raw: string) {
  if (raw.startsWith("native:")) return raw.slice("native:".length);
  const sep = raw.indexOf("::");
  if (sep >= 0) return `gcal_${raw.slice(sep + 2)}`;
  return raw;
}

export function EventAssetPanel({
  eventId,
  title,
  startAt,
  endAt,
  allDay,
}: {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
}) {
  const toast = useToast();
  const id = normalizeEventId(eventId);
  const [bucket, setBucket] = useState<string | null>(null);
  const [earning, setEarning] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("followers");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/calendar/events/${encodeURIComponent(id)}/post`)
      .then((r) => (r.ok ? r.json() : { post: null }))
      .then((d) => {
        if (!alive || !d.post) return;
        setImages(d.post.imageUrls ?? []);
        setVisibility(d.post.visibility ?? "followers");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  const saveBucket = async (next: string | null) => {
    setBucket(next);
    await fetch("/api/v1/time-asset/event-bucket", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, bucket: next }),
    });
  };

  const saveEarning = async () => {
    const raw = window.prompt("이 일정으로 번 금액 (원)", earning ? String(earning) : "");
    if (raw === null) return;
    const digits = raw.replace(/[^\d]/g, "");
    const amount = digits ? Number(digits) : null;
    const res = await fetch("/api/v1/time-asset/event-earning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, amountKrw: amount }),
    });
    if (res.ok) {
      setEarning(amount);
      toast.success(amount ? "수익을 기록했어요" : "수익 기록을 해제했어요");
    } else {
      toast.error("저장하지 못했어요.");
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("files", file);
        form.append("title", title);
        form.append("startAt", startAt);
        form.append("endAt", endAt);
        form.append("allDay", String(allDay));
        const res = await fetch(
          `/api/v1/calendar/events/${encodeURIComponent(id)}/post`,
          { method: "POST", body: form },
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "사진을 올리지 못했어요.");
          return;
        }
        setImages(data.post?.imageUrls ?? []);
      }
      toast.success("사진을 붙였어요");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const changeVisibility = async (next: string) => {
    setVisibility(next);
    await fetch(`/api/v1/calendar/events/${encodeURIComponent(id)}/post`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, startAt, endAt, allDay, visibility: next }),
    });
  };

  return (
    <div className="mt-4 space-y-3 border-t border-charcoal-800/50 pt-4">
      {/* 자산 분류 */}
      <div>
        <p className="mb-1.5 text-2xs font-medium text-charcoal-500">자산 분류</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => saveBucket(null)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              bucket === null
                ? "bg-charcoal-800 text-charcoal-100"
                : "text-charcoal-500 hover:text-charcoal-300"
            }`}
          >
            기본
          </button>
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => saveBucket(b.key)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={
                bucket === b.key
                  ? { backgroundColor: `${b.color}26`, color: b.color }
                  : { color: "rgb(var(--c-500))" }
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 수익 기록 */}
      <button
        type="button"
        onClick={saveEarning}
        className="flex w-full items-center justify-between rounded-lg border border-charcoal-800/60 px-3 py-2 text-left text-xs hover:border-charcoal-700"
      >
        <span className="text-charcoal-300">수익 기록</span>
        <span className={earning ? "font-semibold text-navy-400" : "text-charcoal-500"}>
          {earning ? `₩${earning.toLocaleString("ko-KR")}` : "자동 (시급 기준)"}
        </span>
      </button>

      {/* 사진 기록 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-2xs font-medium text-charcoal-500">사진 기록</p>
          {images.length > 0 && (
            <select
              value={visibility}
              onChange={(e) => changeVisibility(e.target.value)}
              className="rounded border border-charcoal-800/60 bg-transparent px-1.5 py-0.5 text-2xs text-charcoal-400 focus:outline-none"
            >
              <option value="private">비공개</option>
              <option value="followers">팔로워 공개</option>
              <option value="public">전체 공개</option>
            </select>
          )}
        </div>
        {images.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto">
            {images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => upload(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-charcoal-800/60 px-3 py-1.5 text-xs text-navy-400 hover:border-navy-500/50 disabled:opacity-50"
        >
          {busy ? "올리는 중…" : images.length > 0 ? "사진 추가" : "사진 붙이기"}
        </button>
        <p className="mt-1.5 text-2xs text-charcoal-600">
          사진을 붙이면 타임라인에 기록으로 남아요.
        </p>
      </div>
    </div>
  );
}
