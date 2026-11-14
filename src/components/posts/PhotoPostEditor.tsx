"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostBody } from "@/components/posts/PostBody";
import { resizeImageToJpeg } from "@/lib/image-resize";
import {
  addPhotoAction,
  createPostAction,
  deletePostAction,
  removePhotoAction,
  reorderPhotosAction,
  setPhotoCaptionAction,
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
  /** 사진 설명(선택, 200자) */
  caption: string;
  /** 서버에 저장된 설명 — 바뀐 것만 보낸다 */
  savedCaption: string;
};

export type EditorInitial = {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublic: boolean;
  photos: { id: string; url: string | null; caption?: string | null }[];
};

type Draft = { title: string; body: string; at: number };
const draftKey = (id: string) => `orbit42:post-draft:${id}`;
const AUTOSAVE_MS = 1500;

const MAX = 10;
const MAX_SOURCE = 10 * 1024 * 1024; // 고를 수 있는 원본 한 장

/** 웹 글·사진 쓰기·고치기(1.10.0) — 앱과 같은 API 규칙: 나만 보기로 만들고 사진을 다 올린 뒤 공개 범위 적용 */
export function PhotoPostEditor({ username, initial }: { username: string; initial?: EditorInitial }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(() =>
    (initial?.photos ?? []).map((p) => ({ key: p.id, remoteId: p.id, src: p.url, caption: p.caption ?? "", savedCaption: p.caption ?? "" })),
  );
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  // 자동 저장: 서버에 '나만 보기'인 글(새 글 포함)만 서버로, 이미 공개된 글은 이 브라우저에만 둔다
  const serverPublic = useRef(initial?.isPublic ?? false);
  const savedText = useRef({ title: initial?.title ?? "", body: initial?.body ?? "" });
  const creating = useRef<Promise<string> | null>(null);
  const [autoState, setAutoState] = useState<"idle" | "saving" | "saved" | "local" | "failed">("idle");
  const [restore, setRestore] = useState<Draft | null>(null);
  const done = useRef(false);

  /** 글 id — 없으면 '나만 보기'로 한 번만 만든다(자동 저장과 올리기가 겹쳐도 하나) */
  const ensureId = useCallback(async (t: string, b: string): Promise<string> => {
    if (postId) return postId;
    if (!creating.current) {
      creating.current = createPostAction({ title: t, body: b }).then((r) => {
        if ("error" in r) {
          creating.current = null;
          throw new Error(r.error);
        }
        setPostId(r.post.id);
        savedText.current = { title: t, body: b };
        // 주소는 그대로 둔다(replaceState 는 Next 라우터가 받아 편집기를 다시 그려 입력이 날아감).
        // 임시 저장 글은 내 목록에 '임시 저장'으로 남아 거기서 이어 쓴다.
        return r.post.id;
      });
    }
    return creating.current;
  }, [postId]);

  // 이 브라우저에 남은 고친 내용(공개 글) 되살리기
  useEffect(() => {
    if (!initial) return;
    try {
      const raw = localStorage.getItem(draftKey(initial.id));
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d.title !== initial.title || d.body !== initial.body) setRestore(d);
      else localStorage.removeItem(draftKey(initial.id));
    } catch {
      /* 무시 */
    }
  }, [initial]);

  // 자동 저장(입력 멈추고 1.5초 뒤)
  useEffect(() => {
    if (saving || done.current) return;
    if (title === savedText.current.title && body === savedText.current.body) return;
    const t = setTimeout(async () => {
      if (serverPublic.current && postId) {
        try {
          localStorage.setItem(draftKey(postId), JSON.stringify({ title, body, at: Date.now() } satisfies Draft));
          setAutoState("local");
        } catch {
          setAutoState("failed");
        }
        return;
      }
      if (!postId && !title.trim() && !body.trim()) return;
      setAutoState("saving");
      try {
        const id = await ensureId(title, body);
        if (savedText.current.title !== title || savedText.current.body !== body) {
          const r = await updatePostAction(id, { title, body });
          if ("error" in r) throw new Error(r.error);
          savedText.current = { title, body };
        }
        setAutoState("saved");
      } catch {
        setAutoState("failed");
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [title, body, postId, saving, ensureId]);

  // 아직 안 올린 사진이나 저장 못 한 글이 있으면 떠나기 전에 묻기
  const unsaved = items.some((i) => !i.remoteId) || removed.length > 0 || items.some((i) => i.caption !== i.savedCaption) || autoState === "failed";
  useEffect(() => {
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => {
      if (done.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved]);

  // ── 서식 버튼 ──
  const edit = (fn: (v: string, a: number, b: number) => { v: string; a: number; b: number }) => {
    const el = bodyRef.current;
    if (!el) return;
    const r = fn(body, el.selectionStart, el.selectionEnd);
    setBody(r.v.slice(0, 5000));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.a, r.b);
    });
  };
  const wrap = (mark: string, fallback: string) =>
    edit((v, a, b) => {
      const sel = v.slice(a, b) || fallback;
      return { v: v.slice(0, a) + mark + sel + mark + v.slice(b), a: a + mark.length, b: a + mark.length + sel.length };
    });
  const prefixLines = (prefix: string) =>
    edit((v, a, b) => {
      const start = v.lastIndexOf("\n", a - 1) + 1;
      const endIdx = v.indexOf("\n", b);
      const end = endIdx === -1 ? v.length : endIdx;
      const lines = v.slice(start, end).split("\n");
      const all = lines.every((l) => l.startsWith(prefix));
      const next = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l.replace(/^(#{1,6}|>|[-*+])\s+/, ""))).join("\n");
      return { v: v.slice(0, start) + next + v.slice(end), a: start, b: start + next.length };
    });
  const link = () =>
    edit((v, a, b) => {
      const sel = v.slice(a, b) || "링크 글자";
      const ins = `[${sel}](https://)`;
      const urlAt = a + sel.length + 3;
      return { v: v.slice(0, a) + ins + v.slice(b), a: urlAt, b: urlAt + 8 };
    });

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
      next.push({ key: crypto.randomUUID(), src: URL.createObjectURL(small), file: small, caption: "", savedCaption: "" });
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
      const id = await ensureId(title, body);
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
            updated[i] = { ...it, remoteId: r.photo.id, failed: false, savedCaption: "" };
          }
          setProgress({ done: n + 1, total: pending.length });
          setItems([...updated]);
        }
        if (failures) throw new Error(`사진 ${failures}장을 올리지 못했어요. 다시 저장하면 남은 사진만 올려요.`);
        items.splice(0, items.length, ...updated);
      }
      for (const it of items) {
        if (!it.remoteId || it.caption.trim() === it.savedCaption) continue;
        const r = await setPhotoCaptionAction(id, it.remoteId, it.caption.trim() || null);
        if ("error" in r) throw new Error(r.error);
        it.savedCaption = it.caption.trim();
      }
      const order = items.map((it) => it.remoteId).filter((x): x is string => !!x);
      if (order.length > 1) {
        const r = await reorderPhotosAction(id, order);
        if ("error" in r) throw new Error(r.error);
      }
      const r = await updatePostAction(id, { title, body, public: isPublic });
      if ("error" in r) throw new Error(r.error);
      done.current = true;
      try {
        localStorage.removeItem(draftKey(id));
      } catch {
        /* 무시 */
      }
      router.push(isPublic || initial ? `/${username}/blog/${encodeURIComponent(r.post.slug)}` : `/${username}/blog`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const destroy = async () => {
    if (!postId || !window.confirm(initial ? "이 글을 지울까요? 사진도 함께 지워져요." : "임시 저장한 글을 지울까요?")) return;
    setSaving(true);
    const r = await deletePostAction(postId);
    setSaving(false);
    if ("error" in r) setError(r.error);
    else {
      done.current = true;
      try {
        localStorage.removeItem(draftKey(postId));
      } catch {
        /* 무시 */
      }
      router.push(`/${username}/blog`);
      router.refresh();
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 max-md:pb-[var(--mobile-nav-pb)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-charcoal-50">{initial ? "글 고치기" : "새 글"}</h1>
          <p className="min-h-4 text-xs text-charcoal-500" role="status" data-testid="autoState">
            {autoState === "saving" && "임시 저장 중…"}
            {autoState === "saved" && "나만 보기로 임시 저장했어요"}
            {autoState === "local" && "이 브라우저에 임시 저장했어요 · 저장을 눌러야 공개 글에 반영돼요"}
            {autoState === "failed" && <span className="text-red-400">임시 저장하지 못했어요 · 연결을 확인해 주세요</span>}
          </p>
        </div>
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

      {restore && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200" role="status">
          <span className="mr-auto">저장하지 않고 닫은 고친 내용이 있어요.</span>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 font-semibold hover:bg-amber-500/10"
            onClick={() => {
              setTitle(restore.title);
              setBody(restore.body);
              setRestore(null);
            }}
          >
            불러오기
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-amber-300/80 hover:bg-amber-500/10"
            onClick={() => {
              if (initial) localStorage.removeItem(draftKey(initial.id));
              setRestore(null);
            }}
          >
            버리기
          </button>
        </div>
      )}

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
                  <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 text-2xs font-bold text-white ${i === 0 ? "bg-navy-500" : "bg-black/55"}`}>{i === 0 ? "대표" : i + 1}</span>
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
                <input
                  value={it.caption}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 200);
                    setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, caption: v } : x)));
                  }}
                  maxLength={200}
                  disabled={saving}
                  aria-label={`사진 ${i + 1} 설명`}
                  placeholder="설명 (선택)"
                  className="min-h-11 w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-2 text-xs text-charcoal-50 placeholder:text-charcoal-500 focus:border-navy-400 focus:outline-none"
                  data-testid="photoCaption"
                />
              </li>
            ))}
            {importing && <li className="flex aspect-square items-center justify-center rounded-lg bg-charcoal-900/60 text-xs text-charcoal-400">줄이는 중…</li>}
          </ul>
        )}
        <p className="text-xs text-charcoal-500">첫 사진이 대표 사진이에요 — 목록과 공유 미리보기에 보여요. 끌어서 놓거나 ‹ ›로 순서를 바꿔요. 촬영 위치 같은 사진 속 정보는 올리기 전에 지워져요.</p>
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
        <div className="space-y-1">
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="postBody" className="text-sm font-semibold text-charcoal-200">
              내용 (선택)
            </label>
            <div className="flex text-xs" role="tablist" aria-label="쓰기·미리보기">
              {(["write", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`min-h-11 px-3 ${tab === t ? "font-semibold text-charcoal-50" : "text-charcoal-400 hover:text-charcoal-100"}`}
                >
                  {t === "write" ? "쓰기" : "미리보기"}
                </button>
              ))}
            </div>
          </div>
          {tab === "write" ? (
            <div className="overflow-hidden rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 focus-within:border-navy-400">
              <div className="flex flex-wrap border-b border-charcoal-800/60" role="toolbar" aria-label="서식">
                {[
                  { label: "B", aria: "굵게", cls: "font-bold", on: () => wrap("**", "굵은 글자") },
                  { label: "H", aria: "소제목", cls: "font-bold", on: () => prefixLines("## ") },
                  { label: "•", aria: "목록", cls: "text-lg", on: () => prefixLines("- ") },
                  { label: "❝", aria: "인용", cls: "", on: () => prefixLines("> ") },
                  { label: "🔗", aria: "링크", cls: "", on: link },
                ].map((b) => (
                  <button
                    key={b.aria}
                    type="button"
                    aria-label={b.aria}
                    title={b.aria}
                    onClick={b.on}
                    disabled={saving}
                    className={`flex h-11 w-11 items-center justify-center text-sm text-charcoal-200 hover:bg-charcoal-800/60 hover:text-charcoal-50 ${b.cls}`}
                    data-testid={`fmt-${b.aria}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <textarea
                id="postBody"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                rows={8}
                className="block w-full bg-transparent px-3 py-2 text-sm text-charcoal-50 placeholder:text-charcoal-500 focus:outline-none"
                placeholder="작업 이야기나 소식을 적어 주세요"
                data-testid="postBody"
              />
            </div>
          ) : (
            <div className="min-h-[12rem] rounded-lg border border-charcoal-800/60 bg-charcoal-900/20 px-3 py-2" data-testid="postPreview">
              {body.trim() ? <PostBody text={body} /> : <p className="text-sm text-charcoal-500">미리 볼 내용이 없어요.</p>}
            </div>
          )}
          <p className="text-xs text-charcoal-500">## 소제목 · **굵게** · - 목록 · &gt; 인용 · [글자](주소). 주소는 그대로 붙여도 링크가 돼요.</p>
        </div>
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

      {postId && (
        <div className="border-t border-charcoal-800/40 pt-5">
          <button type="button" onClick={destroy} disabled={saving} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50">
            {initial ? "이 글 지우기" : "임시 저장한 글 지우기"}
          </button>
        </div>
      )}
    </div>
  );
}
