"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note, NoteCategory } from "../actions";
import { updateNote, deleteNote, togglePin } from "../actions";

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: "idea", label: "아이디어" },
  { value: "meeting", label: "회의록" },
  { value: "memo", label: "메모" },
];

export default function NoteEditor({ note: initialNote }: { note: Note }) {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const [note, setNote] = useState(initialNote);
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content);
  const [category, setCategory] = useState<NoteCategory>(initialNote.category);
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges =
    title !== note.title || content !== note.content || category !== note.category;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaved(false);
    saveTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const updated = await updateNote(note.id, { title, content, category });
        setNote(updated);
        setSaved(true);
      });
    }, 1500);
  }, [note.id, title, content, category]);

  useEffect(() => {
    if (hasChanges) scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, category, hasChanges, scheduleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setTab((t) => (t === "write" ? "preview" : "write"));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Tab key support in textarea
  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + "  " + content.slice(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  function handleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    startTransition(async () => {
      const updated = await updateNote(note.id, { title, content, category });
      setNote(updated);
      setSaved(true);
    });
  }

  function handleDelete() {
    if (!confirm("이 노트를 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteNote(note.id);
      router.push(`/${params.username}/notes`);
    });
  }

  function handleTogglePin() {
    startTransition(async () => {
      const updated = await togglePin(note.id);
      setNote(updated);
    });
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12))] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push(`/${params.username}/notes`)}
            className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoteCategory)}
            className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-1.5 text-xs font-medium text-charcoal-100 focus:border-navy-500 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <button
            onClick={handleTogglePin}
            title={note.pinned ? "고정 해제" : "고정"}
            className={`rounded-lg p-1.5 transition-colors ${
              note.pinned ? "text-amber-400 hover:text-amber-300" : "text-charcoal-500 hover:text-charcoal-300"
            }`}
          >
            <svg className="h-5 w-5" fill={note.pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
          </button>

          {/* Write / Preview tabs */}
          <div className="flex rounded-lg border border-charcoal-700 overflow-hidden">
            <button
              onClick={() => setTab("write")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                tab === "write" ? "bg-charcoal-700 text-charcoal-100" : "text-charcoal-500 hover:text-charcoal-300"
              }`}
            >
              작성
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                tab === "preview" ? "bg-charcoal-700 text-charcoal-100" : "text-charcoal-500 hover:text-charcoal-300"
              }`}
            >
              미리보기
            </button>
          </div>

          <span className="hidden text-xs text-charcoal-600 sm:inline">
            {isPending ? "저장 중..." : saved ? "저장됨" : "편집 중..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-charcoal-600 sm:inline">
            {content.length}자
          </span>
          <button
            onClick={handleSave}
            disabled={isPending || saved}
            className="rounded-lg bg-navy-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50"
          >
            저장
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg border border-charcoal-700 px-4 py-1.5 text-sm font-medium text-red-400 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-50"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="mb-4 w-full border-none bg-transparent text-2xl font-bold text-charcoal-100 placeholder:text-charcoal-700 focus:outline-none"
      />

      {/* Content: Write / Preview */}
      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="내용을 작성하세요... (Markdown 지원)"
          className="flex-1 w-full resize-none rounded-xl border border-charcoal-700 bg-charcoal-800/50 p-5 text-sm leading-relaxed text-charcoal-100 placeholder:text-charcoal-700 focus:border-navy-500 focus:outline-none font-mono"
        />
      ) : (
        <div className="flex-1 overflow-auto rounded-xl border border-charcoal-700 bg-charcoal-800/50 p-5">
          {content ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-charcoal-100 prose-p:text-charcoal-300 prose-strong:text-charcoal-200 prose-a:text-navy-400 prose-code:text-emerald-400 prose-code:bg-charcoal-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-charcoal-800 prose-pre:border prose-pre:border-charcoal-700 prose-blockquote:border-navy-500 prose-blockquote:text-charcoal-400 prose-li:text-charcoal-300 prose-hr:border-charcoal-700 prose-th:text-charcoal-200 prose-td:text-charcoal-300 prose-img:rounded-lg">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-charcoal-600">내용이 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
