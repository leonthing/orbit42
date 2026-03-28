"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useMemo, useTransition } from "react";
import type { Note, NoteCategory } from "./actions";
import { createNote, deleteNote, togglePin } from "./actions";

const CATEGORY_TABS: { label: string; value: NoteCategory | null }[] = [
  { label: "전체", value: null },
  { label: "아이디어", value: "idea" },
  { label: "회의록", value: "meeting" },
  { label: "메모", value: "memo" },
];

const CATEGORY_BADGE: Record<NoteCategory, { label: string; cls: string }> = {
  idea: { label: "아이디어", cls: "bg-violet-500/15 text-violet-400" },
  meeting: { label: "회의록", cls: "bg-blue-500/15 text-blue-400" },
  memo: { label: "메모", cls: "bg-charcoal-700/40 text-charcoal-400" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function contentPreview(content: string, max = 150) {
  if (!content) return "";
  const stripped = content.replace(/[#*_`>\-\[\]()!]/g, "").replace(/\n+/g, " ").trim();
  return stripped.length > max ? stripped.slice(0, max) + "..." : stripped;
}

function wordCount(content: string) {
  if (!content) return 0;
  return content.trim().length;
}

export default function NoteList({ initialNotes }: { initialNotes: Note[] }) {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const [notes, setNotes] = useState(initialNotes);
  const [activeCategory, setActiveCategory] = useState<NoteCategory | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let result = notes;
    if (activeCategory) {
      result = result.filter((n) => n.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, activeCategory, search]);

  function handleCreate() {
    startTransition(async () => {
      const note = await createNote({ title: "새 노트" });
      router.push(`/${params.username}/notes/${note.id}`);
    });
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("이 노트를 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    });
  }

  function handleTogglePin(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    startTransition(async () => {
      const updated = await togglePin(id);
      setNotes((prev) =>
        prev
          .map((n) => (n.id === id ? updated : n))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          })
      );
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Notes</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            {notes.length}개의 노트
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50"
        >
          + 새 노트
        </button>
      </div>

      {/* Search + View toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목이나 내용으로 검색..."
            className="w-full rounded-lg border border-charcoal-800 bg-charcoal-900/40 py-2.5 pl-10 pr-4 text-sm text-charcoal-200 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
          />
        </div>

        <div className="flex rounded-lg border border-charcoal-700 overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            title="리스트 뷰"
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-charcoal-700 text-charcoal-100" : "text-charcoal-500 hover:text-charcoal-300"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            title="그리드 뷰"
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-charcoal-700 text-charcoal-100" : "text-charcoal-500 hover:text-charcoal-300"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2">
        {CATEGORY_TABS.map((tab) => {
          const count = tab.value
            ? notes.filter((n) => n.category === tab.value).length
            : notes.length;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveCategory(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === tab.value
                  ? "bg-navy-600/15 text-navy-400"
                  : "text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-charcoal-600">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Notes */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
          <svg className="h-12 w-12 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          <p className="mt-4 text-sm text-charcoal-500">
            {search ? "검색 결과가 없습니다" : "작성된 노트가 없습니다"}
          </p>
          <p className="mt-1 text-xs text-charcoal-600">
            {search ? "다른 키워드로 검색해보세요" : "첫 번째 아이디어를 기록해보세요"}
          </p>
        </div>
      ) : viewMode === "list" ? (
        /* List View */
        <div className="divide-y divide-charcoal-800/40 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
          {filtered.map((note) => {
            const badge = CATEGORY_BADGE[note.category];
            return (
              <div
                key={note.id}
                onClick={() => router.push(`/${params.username}/notes/${note.id}`)}
                className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-charcoal-800/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {note.pinned && (
                      <svg className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                      </svg>
                    )}
                    <h3 className="truncate font-medium text-charcoal-100">
                      {note.title}
                    </h3>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  {note.content && (
                    <p className="mt-1 truncate text-sm text-charcoal-500">
                      {contentPreview(note.content, 200)}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-charcoal-600">
                    <span>{formatDate(note.updated_at)}</span>
                    <span>{wordCount(note.content)}자</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => handleTogglePin(e, note.id)}
                    title={note.pinned ? "고정 해제" : "고정"}
                    className={`rounded p-1 transition-colors ${
                      note.pinned ? "text-amber-400 hover:text-amber-300" : "text-charcoal-500 hover:text-charcoal-300"
                    }`}
                  >
                    <svg className="h-4 w-4" fill={note.pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    title="삭제"
                    className="rounded p-1 text-charcoal-500 transition-colors hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => {
            const badge = CATEGORY_BADGE[note.category];
            return (
              <div
                key={note.id}
                onClick={() => router.push(`/${params.username}/notes/${note.id}`)}
                className="group cursor-pointer rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5 transition-colors hover:border-charcoal-700"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleTogglePin(e, note.id)}
                      title={note.pinned ? "고정 해제" : "고정"}
                      className={`rounded p-1 transition-colors ${
                        note.pinned
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-charcoal-600 opacity-0 group-hover:opacity-100 hover:text-charcoal-400"
                      }`}
                    >
                      <svg className="h-4 w-4" fill={note.pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, note.id)}
                      title="삭제"
                      className="rounded p-1 text-charcoal-600 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-charcoal-100 line-clamp-1">{note.title}</h3>

                {note.content && (
                  <p className="mt-2 text-sm text-charcoal-500 line-clamp-3">
                    {contentPreview(note.content)}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 text-xs text-charcoal-600">
                  <span>{formatDate(note.updated_at)}</span>
                  <span>{wordCount(note.content)}자</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
