"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resizeImageToJpeg } from "@/lib/image-resize";
import {
  addPhotoAction,
  createPostAction,
  deletePostAction,
  removePhotoAction,
  reorderPhotosAction,
  updatePostAction,
} from "@/lib/posts-actions";

type Item = {
  key: string;
  /** 이미 올라간 사진 id */
  remoteId?: string;
  /** 미리보기 주소(서명 URL 또는 object URL) */
  src: string | null;
  /** 아직 안 올린 사진(긴 변 2048 JPEG로 줄인 파일) */
  file?: File;
  failed?: boolean;
};

export type EditorInitial = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublic: boolean;
  photos: { id: string; url: string | null }[];
};

const MAX = 10;
const MAX_SOURCE = 10 * 1024 * 1024; // 고를 수 있는 원본 한 장

/** 웹 글·사진 쓰기·고치기(1.10.0) — 앱과 같은 API 규칙: 나만 보기로 만들고 사진을 다 올린 뒤 공개 범위 적용 */
export function PhotoPostEditor({ username, initial }: { username: string; initial?: EditorInitial }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(() => (initial?.photos ?? []).map((p) => ({ key: p.id, remoteId: p.id, src: p.url })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [postId, setPostId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 떠날 때 object URL 정리
  useEffect(() => () => items.forEach((i) => i.file && i.src && URL.revokeObjectURL(i.src)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = items.length === 0 && !title.trim() && !body.trim();

  const pick = async (files: FileList | null) => {
    if (!files) return;
    setImporting(true);
    setError(null);
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      if (items.length + next.length >= MAX) {
        setError("사진은 글 하나에 10장까지예요.");
        break;
      }
      if (!f.type.startsWith("image/") || f.type === "image/gif") {
        setError("JPG·PNG·HEIC 사진만 올릴 수 있어요.");
        continue;
      }
      if (f.size > MAX_SOURCE) {
        setError("10MB가 넘는 사진은 뺐어요.");
        continue;
      }
      const small = await resizeImageToJpeg(f, { maxDimension: 2048, quality: 0.85 });
      if (small.type !== "image/jpeg") {
        setError("읽을 수 없는 사진이 있어 뺐어요. JPG·PNG로 올려 주세요.");
        continue;
      }
      next.push({ key: crypto.randomUUID(), src: URL.createObjectURL(small), file: small });
    }
    setItems((cur) => [...cur, ...next]);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((cur) => {
      const a = [...cur];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  };

  const remove = (i: number) => {
    const it = items[i];
    if (it.remoteId) setRemoved((r) => [...r, it.remoteId!]);
    if (it.file && it.src) URL.revokeObjectURL(it.src);
    setItems((cur) => cur.filter((_, j) => j !== i));
  };

  const save = async () => {
    if (saving || empty) return;
    setSaving(true);
    setError(null);
    try {
      let id = postId;
      if (!id) {
        const r = await createPostAction({ title, body });
        if ("error" in r) throw new Error(r.error);
        id = r.post.id;
        setPostId(id);
      }
      for (const rid of removed) {
        const r = await removePhotoAction(id, rid);
        if ("error" in r) throw new Error(r.error);
      }
      setRemoved([]);
      const pending = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.remoteId);
      let failures = 0;
      if (pending.length) {
        setProgress({ done: 0, total: pending.length });
        const updated = [...items];
        for (let n = 0; n < pending.length; n++) {
          const { it, i } = pending[n];
          const fd = new FormData();
          fd.append("photo", it.file!, "photo.jpg");
          const r = await addPhotoAction(id, fd).catch(() => ({ error: "사진을 올리지 못했어요." }) as const);
          if ("error" in r) {
            failures++;
            updated[i] = { ...it, failed: true };
          } else {
            updated[i] = { ...it, remoteId: r.photo.id, failed: false };
          }
          setProgress({ done: n + 1, total: pending.length });
          setItems([...updated]);
        }
        if (failures) throw new Error(`사진 ${failures}장을 올리지 못했어요. 다시 저장하면 남은 사진만 올려요.`);
        items.splice(0, items.length, ...updated);
      }
      const order = items.map((it) => it.remoteId).filter((x): x is string => !!x);
      if (order.length > 1) {
        const r = await reorderPhotosAction(id, order);
        if ("error" in r) throw new Error(r.error);
      }
      const r = await updatePostAction(id, { title, body, public: isPublic });
      if ("error" in r) throw new Error(r.error);
      router.push(initial ? `/${username}/blog/${encodeURIComponent(initial.slug)}` : `/${username}/blog`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const destroy = async () => {
    if (!postId || !window.confirm("이 글을 지울까요? 사진도 함께 지워져요.")) return;
    setSaving(true);
    const r = await deletePostAction(postId);
    setSaving(false);
    if ("error" in r) setError(r.error);
    else {
      router.push(`/${username}/blog`);
      router.refresh();
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 max-md:pb-[var(--mobile-nav-pb)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-charcoal-50">{initial ? "글 고치기" : "새 글"}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-charcoal-300 hover:text-charcoal-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || importing || empty}
            className="inline-flex min-h-11 items-center rounded-lg bg-navy-500 px-5 text-sm font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
            data-testid="savePost"
          >
            {saving ? "저장 중…" : initial ? "저장" : "올리기"}
          </button>
        </div>
      </div>

      <section className="space-y-3" aria-labelledby="photos-label">
        <div className="flex items-center justify-between">
          <h2 id="photos-label" className="text-sm font-semibold text-charcoal-200">
            사진 <span className="font-normal text-charcoal-500">{items.length}/10</span>
          </h2>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={items.length >= MAX || saving}
            className="inline-flex min-h-11 items-center rounded-lg border border-charcoal-800/60 px-4 text-sm text-charcoal-100 hover:border-charcoal-700 disabled:opacity-50"
          >
            {items.length ? "사진 더 고르기" : "사진 고르기"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} data-testid="photoInput" />
        </div>
        {(items.length > 0 || importing) && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((it, i) => (
              <li
                key={it.key}
                draggable={!saving}
                onDragStart={() => setDragKey(it.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = items.findIndex((x) => x.key === dragKey);
                  if (from >= 0) move(from, i);
                  setDragKey(null);
                }}
                className={`space-y-1 ${dragKey === it.key ? "opacity-50" : ""}`}
              >
                <div className={`relative aspect-square overflow-hidden rounded-lg bg-charcoal-900/60 ${it.failed ? "ring-2 ring-red-500" : ""} cursor-grab`}>
                  {it.src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.src} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                  )}
                  <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 text-2xs font-bold text-white ${i === 0 ? "bg-navy-500" : "bg-black/55"}`}>{i + 1}</span>
                  {it.failed && <span className="absolute inset-x-0 bottom-0 bg-red-600/80 py-0.5 text-center text-2xs text-white">못 올림</span>}
                </div>
                <div className="flex justify-between">
                  <button type="button" aria-label="앞으로" onClick={() => move(i, i - 1)} disabled={i === 0 || saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-charcoal-300 hover:text-charcoal-50 disabled:opacity-30">
                    ‹
                  </button>
                  <button type="button" aria-label="사진 빼기" onClick={() => remove(i)} disabled={saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-red-400 hover:text-red-300 disabled:opacity-30">
                    ×
                  </button>
                  <button type="button" aria-label="뒤로" onClick={() => move(i, i + 1)} disabled={i === items.length - 1 || saving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-charcoal-300 hover:text-charcoal-50 disabled:opacity-30">
                    ›
                  </button>
                </div>
              </li>
            ))}
            {importing && <li className="flex aspect-square items-center justify-center rounded-lg bg-charcoal-900/60 text-xs text-charcoal-400">줄이는 중…</li>}
          </ul>
        )}
        <p className="text-xs text-charcoal-500">첫 사진이 목록에 보여요. 끌어서 놓거나 ‹ ›로 순서를 바꿔요. 촬영 위치 같은 사진 속 정보는 올리기 전에 지워져요.</p>
      </section>

      <section className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-charcoal-200">제목 (선택)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="min-h-11 w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 text-sm text-charcoal-50 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none"
            placeholder="제목"
            data-testid="postTitle"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-charcoal-200">내용 (선택)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={6}
            className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-50 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none"
            placeholder="작업 이야기나 소식을 적어 주세요"
            data-testid="postBody"
          />
        </label>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-charcoal-200">공개 범위</legend>
        <div className="flex gap-2">
          {[
            { v: true, label: "전체 공개" },
            { v: false, label: "나만 보기" },
          ].map((o) => (
            <label
              key={String(o.v)}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm ${isPublic === o.v ? "border-navy-400 bg-navy-500/15 text-charcoal-50" : "border-charcoal-800/60 text-charcoal-300"}`}
            >
              <input type="radio" name="visibility" className="sr-only" checked={isPublic === o.v} onChange={() => setIsPublic(o.v)} />
              {o.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-charcoal-500">{isPublic ? "링크 페이지를 찾은 누구나 볼 수 있어요." : "나에게만 보여요. 나중에 공개로 바꿀 수 있어요."}</p>
      </fieldset>

      {progress && (
        <div className="space-y-1" role="status">
          <div className="h-1.5 overflow-hidden rounded-full bg-charcoal-800">
            <div className="h-full bg-navy-400 transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-charcoal-400 tabular-nums">
            사진 올리는 중 {progress.done}/{progress.total}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {initial && (
        <div className="border-t border-charcoal-800/40 pt-5">
          <button type="button" onClick={destroy} disabled={saving} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50">
            이 글 지우기
          </button>
        </div>
      )}
    </div>
  );
}
