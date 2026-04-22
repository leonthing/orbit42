"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { BlogPost } from "../../actions";
import {
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
  unpublishBlogPost,
} from "../../actions";
import { uploadBlogImage } from "@/lib/blog-media";
import { useConfirm } from "@/components/ConfirmDialog";

type ToolbarAction = {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.744h-.753v8.25h7.125a4.125 4.125 0 0 0 0-8.25H6.75Zm0 0v8.25m0 0h-.753v7.5h8.25a4.125 4.125 0 0 0 0-8.25H6.75v.75Z" />,
    label: "굵게 (⌘B)",
    prefix: "**",
    suffix: "**",
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5.248 20.246H9.05m0 0h3.696m-3.696 0 3.696-16.5m0 0h3.803m-3.803 0H9.05" />,
    label: "기울임 (⌘I)",
    prefix: "*",
    suffix: "*",
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />,
    label: "제목",
    prefix: "## ",
    suffix: "",
    block: true,
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />,
    label: "링크",
    prefix: "[",
    suffix: "](url)",
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />,
    label: "코드",
    prefix: "`",
    suffix: "`",
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />,
    label: "코드 블록",
    prefix: "```\n",
    suffix: "\n```",
    block: true,
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />,
    label: "목록",
    prefix: "- ",
    suffix: "",
    block: true,
  },
  {
    icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></>,
    label: "인용",
    prefix: "> ",
    suffix: "",
    block: true,
  },
  {
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />,
    label: "구분선",
    prefix: "\n---\n",
    suffix: "",
    block: true,
  },
];

const PROSE_CLASSES = "prose prose-invert prose-sm max-w-none prose-headings:text-charcoal-100 prose-p:text-charcoal-300 prose-strong:text-charcoal-200 prose-a:text-red-400 prose-code:text-emerald-400 prose-code:bg-charcoal-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-charcoal-800 prose-pre:border prose-pre:border-charcoal-700 prose-blockquote:border-red-500 prose-blockquote:text-charcoal-400 prose-li:text-charcoal-300 prose-hr:border-charcoal-700 prose-th:text-charcoal-200 prose-td:text-charcoal-300 prose-img:rounded-lg";

export default function BlogEditor({ post: initialPost }: { post: BlogPost }) {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const [post, setPost] = useState(initialPost);
  const [title, setTitle] = useState(initialPost.title);
  const [content, setContent] = useState(initialPost.content);
  const [slug, setSlug] = useState(initialPost.slug);
  const [excerpt, setExcerpt] = useState(initialPost.excerpt || "");
  const [tagsInput, setTagsInput] = useState(initialPost.tags.join(", "));
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"write" | "preview" | "split">("write");
  const [showSettings, setShowSettings] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const parseTags = (input: string) =>
    input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const hasChanges =
    title !== post.title ||
    content !== post.content ||
    slug !== post.slug ||
    excerpt !== (post.excerpt || "") ||
    tagsInput !== post.tags.join(", ");

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaved(false);
    saveTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const updated = await updateBlogPost(post.id, {
          title,
          content,
          slug,
          excerpt: excerpt || null,
          tags: parseTags(tagsInput),
        });
        setPost(updated);
        setSaved(true);
      });
    }, 1500);
  }, [post.id, title, content, slug, excerpt, tagsInput]);

  useEffect(() => {
    if (hasChanges) scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, slug, excerpt, tagsInput, hasChanges, scheduleSave]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        insertMarkdown("**", "**");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        insertMarkdown("*", "*");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        insertMarkdown("[", "](url)");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function insertMarkdown(prefix: string, suffix: string, block?: boolean) {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);

    let newContent: string;
    let cursorPos: number;

    if (block && start > 0 && content[start - 1] !== "\n") {
      const blockPrefix = "\n" + prefix;
      newContent = content.slice(0, start) + blockPrefix + selected + suffix + content.slice(end);
      cursorPos = selected ? start + blockPrefix.length + selected.length + suffix.length : start + blockPrefix.length;
    } else {
      newContent = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
      cursorPos = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
    }

    setContent(newContent);
    requestAnimationFrame(() => {
      if (selected) {
        ta.selectionStart = start + prefix.length;
        ta.selectionEnd = start + prefix.length + selected.length;
      } else {
        ta.selectionStart = ta.selectionEnd = cursorPos;
      }
    });
  }

  async function uploadAndInsert(files: FileList | File[] | null | undefined) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.append("file", f);
        const res = await uploadBlogImage(fd);
        if ("error" in res) {
          setUploadError(res.error);
          break;
        }
        const alt = f.name.replace(/\.[^/.]+$/, "") || "image";
        const ta = textareaRef.current;
        const snippet = `\n![${alt}](${res.url})\n`;
        if (ta) {
          const pos = ta.selectionStart;
          const newContent =
            content.slice(0, pos) + snippet + content.slice(pos);
          setContent(newContent);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = pos + snippet.length;
            ta.focus();
          });
        } else {
          setContent((c) => c + snippet);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  function handleTextareaPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const files = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length === 0) return;
    e.preventDefault();
    uploadAndInsert(files);
  }

  function handleTextareaDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    e.preventDefault();
    uploadAndInsert(files);
  }

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
    // Enter key: auto-continue list items
    if (e.key === "Enter" && !e.shiftKey) {
      const ta = e.currentTarget;
      const pos = ta.selectionStart;
      const lineStart = content.lastIndexOf("\n", pos - 1) + 1;
      const currentLine = content.slice(lineStart, pos);
      const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
      if (listMatch) {
        // If the line is only the list marker (empty item), remove it
        if (currentLine.trim() === listMatch[2]) {
          e.preventDefault();
          const newContent = content.slice(0, lineStart) + "\n" + content.slice(pos);
          setContent(newContent);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = lineStart + 1;
          });
        } else {
          e.preventDefault();
          const indent = listMatch[1];
          const marker = listMatch[2];
          const nextMarker = marker.match(/\d+\./) ? `${parseInt(marker) + 1}.` : marker;
          const insert = `\n${indent}${nextMarker} `;
          const newContent = content.slice(0, pos) + insert + content.slice(pos);
          setContent(newContent);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = pos + insert.length;
          });
        }
      }
    }
  }

  function handleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    startTransition(async () => {
      const updated = await updateBlogPost(post.id, {
        title,
        content,
        slug,
        excerpt: excerpt || null,
        tags: parseTags(tagsInput),
      });
      setPost(updated);
      setSaved(true);
    });
  }

  const confirm = useConfirm();
  async function handleDelete() {
    const ok = await confirm({
      title: "이 글을 삭제할까요?",
      body: "삭제한 글은 되돌릴 수 없어요.",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteBlogPost(post.id);
      router.push(`/${params.username}/blog`);
    });
  }

  function handleTogglePublish() {
    startTransition(async () => {
      const updated = post.published
        ? await unpublishBlogPost(post.id)
        : await publishBlogPost(post.id);
      setPost(updated);
    });
  }

  const wordCount = content.trim() ? content.trim().length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 500));

  const renderPreview = () => (
    <div className="flex-1 overflow-auto rounded-xl border border-charcoal-700 bg-charcoal-800/50 p-5">
      {content ? (
        <div className={PROSE_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-charcoal-600">내용이 없습니다</p>
      )}
    </div>
  );

  const renderEditor = () => (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onKeyDown={handleTextareaKeyDown}
      onPaste={handleTextareaPaste}
      onDrop={handleTextareaDrop}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer?.items ?? []).some((it) => it.kind === "file")) {
          e.preventDefault();
        }
      }}
      placeholder="내용을 작성하세요... (Markdown 지원 · 이미지는 붙여넣기/드래그 가능)"
      className="flex-1 w-full resize-none rounded-xl border border-charcoal-700 bg-charcoal-800/50 p-5 text-sm leading-relaxed text-charcoal-100 placeholder:text-charcoal-700 focus:border-red-500 focus:outline-none font-mono"
    />
  );

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.12))] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push(`/${params.username}/blog`)}
            className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>

          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              post.published
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-charcoal-700/40 text-charcoal-400"
            }`}
          >
            {post.published ? "게시됨" : "임시저장"}
          </span>

          {/* View mode tabs */}
          <div className="flex rounded-lg border border-charcoal-700 overflow-hidden">
            {(["write", "split", "preview"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTab(mode)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === mode ? "bg-charcoal-700 text-charcoal-100" : "text-charcoal-500 hover:text-charcoal-300"
                }`}
              >
                {mode === "write" ? "작성" : mode === "split" ? "분할" : "미리보기"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`rounded-lg p-1.5 transition-colors ${
              showSettings ? "text-red-400" : "text-charcoal-500 hover:text-charcoal-300"
            }`}
            title="글 설정"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>

          <span className="hidden text-xs text-charcoal-600 sm:inline">
            {isPending ? "저장 중..." : saved ? "저장됨" : "편집 중..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-charcoal-600 sm:inline">
            {wordCount}자 · {readingTime}분
          </span>
          <button
            onClick={handleTogglePublish}
            disabled={isPending}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              post.published
                ? "border border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800/50"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            } disabled:opacity-50`}
          >
            {post.published ? "게시 취소" : "게시하기"}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || saved}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            저장
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg border border-charcoal-700 p-1.5 text-red-400 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-50"
            title="삭제"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-3 space-y-3 rounded-xl border border-charcoal-700 bg-charcoal-800/30 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-charcoal-400">Slug (URL)</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-charcoal-600">blog.orbit42.org/{params.username}/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]/g, ""))}
                className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-1.5 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-charcoal-400">요약 (Excerpt)</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="글의 요약을 입력하세요 (목록에 표시됩니다)"
              rows={2}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-charcoal-400">태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="개발, 일상, 생각"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-1.5 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="mb-3 w-full border-none bg-transparent text-2xl font-bold text-charcoal-100 placeholder:text-charcoal-700 focus:outline-none"
      />

      {/* Markdown Toolbar */}
      {tab !== "preview" && (
        <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-lg border border-charcoal-700 bg-charcoal-800/30 px-1.5 py-1">
          {TOOLBAR_ACTIONS.map((action, i) => (
            <span key={action.label} className="contents">
              {(i === 3 || i === 4 || i === 6) && (
                <span className="mx-1 h-4 w-px bg-charcoal-700" />
              )}
              {i === 4 && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="이미지 업로드 (붙여넣기/드래그도 돼요)"
                    className="rounded p-1.5 text-charcoal-500 transition-colors hover:bg-charcoal-700/50 hover:text-charcoal-200 disabled:opacity-50"
                  >
                    <svg
                      className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      uploadAndInsert(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <span className="mx-1 h-4 w-px bg-charcoal-700" />
                </>
              )}
              <button
                onClick={() => insertMarkdown(action.prefix, action.suffix, action.block)}
                title={action.label}
                className="rounded p-1.5 text-charcoal-500 transition-colors hover:bg-charcoal-700/50 hover:text-charcoal-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  {action.icon}
                </svg>
              </button>
            </span>
          ))}
          {uploading && (
            <span className="ml-2 text-[11px] text-charcoal-500">
              업로드 중…
            </span>
          )}
          {uploadError && (
            <span className="ml-2 text-[11px] text-red-400">
              {uploadError}
            </span>
          )}
        </div>
      )}

      {/* Content area */}
      {tab === "write" ? (
        renderEditor()
      ) : tab === "preview" ? (
        renderPreview()
      ) : (
        /* Split view */
        <div className="flex flex-1 gap-3 min-h-0">
          <div className="flex flex-1 flex-col min-w-0">
            {renderEditor()}
          </div>
          <div className="flex flex-1 flex-col min-w-0">
            {renderPreview()}
          </div>
        </div>
      )}

    </div>
  );
}
