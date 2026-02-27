"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { savePost, fetchPost } from "../actions";
import { CATEGORIES } from "@/lib/constants";

export function PostEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get("slug");
  const isNew = !editSlug;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Thoughts");
  const [tagsInput, setTagsInput] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!editSlug);

  useEffect(() => {
    if (editSlug) {
      fetchPost(editSlug).then((result) => {
        if ("post" in result && result.post) {
          const p = result.post;
          setTitle(p.title);
          setSlug(p.slug);
          setDescription(p.description);
          setContent(p.content);
          setCategory(p.category);
          setTagsInput(p.tags.join(", "));
          setPublished(p.published);
        }
        setLoading(false);
      });
    }
  }, [editSlug]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (isNew) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^\w\s가-힣-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim()
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const result = await savePost({
      slug: slug || undefined,
      title,
      description,
      content,
      category,
      tags,
      published,
      isNew,
    });

    if ("error" in result && result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      router.push("/admin");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin text-navy-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
            로딩 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-200 bg-white text-charcoal-500 transition-colors hover:bg-charcoal-50 hover:text-charcoal-700 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-400 dark:hover:bg-charcoal-700 dark:hover:text-charcoal-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
              {isNew ? "새 글 작성" : "글 수정"}
            </h1>
            <p className="mt-0.5 text-sm text-charcoal-500 dark:text-charcoal-400">
              {isNew
                ? "마크다운으로 새로운 글을 작성합니다"
                : "기존 글의 내용을 수정합니다"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Publish toggle */}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-charcoal-200 bg-white px-4 py-2.5 shadow-sm transition-colors dark:border-charcoal-600 dark:bg-charcoal-800">
            <div className="relative">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-charcoal-200 transition-colors peer-checked:bg-green-500 peer-focus:ring-2 peer-focus:ring-navy-500/20 dark:bg-charcoal-600 dark:peer-checked:bg-green-500" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              {published ? "공개" : "비공개"}
            </span>
          </label>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-charcoal-200 bg-white px-5 py-2.5 text-sm font-medium text-charcoal-600 shadow-sm transition-all hover:bg-charcoal-50 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || !title || !content}
            className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-navy-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
          >
            {saving ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                저장 중...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <svg
            className="h-5 w-5 shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Meta Card */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="border-b border-charcoal-100 px-6 py-4 dark:border-charcoal-700/50">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-charcoal-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6h.008v.008H6V6Z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
              글 정보
            </h2>
          </div>
        </div>
        <div className="space-y-5 p-6">
          {/* Title */}
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
              placeholder="글 제목을 입력하세요"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              슬러그
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border border-charcoal-200 bg-charcoal-50 transition-all focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50">
              <span className="border-r border-charcoal-200 bg-charcoal-100 px-3 py-3 text-sm text-charcoal-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-400">
                /blog/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-transparent px-3 py-3 text-sm text-charcoal-900 focus:outline-none dark:text-charcoal-100"
                placeholder="url-slug"
                readOnly={!isNew}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              설명
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
              placeholder="검색 결과와 미리보기에 표시되는 짧은 설명"
            />
          </div>

          {/* Category & Tags */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
                카테고리
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 pr-10 text-charcoal-900 transition-all focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:focus:bg-charcoal-900"
                >
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg
                    className="h-4 w-4 text-charcoal-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
                태그 <span className="text-charcoal-400 font-normal">(쉼표 구분)</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
                placeholder="Next.js, React, 블로그"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="flex items-center justify-between border-b border-charcoal-100 px-6 py-4 dark:border-charcoal-700/50">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-charcoal-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
              내용 <span className="text-red-400">*</span>
            </h2>
          </div>
          <span className="rounded-md bg-charcoal-100 px-2 py-1 text-xs font-medium text-charcoal-500 dark:bg-charcoal-700 dark:text-charcoal-400">
            Markdown
          </span>
        </div>
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 font-mono text-sm leading-relaxed text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            placeholder="마크다운으로 글을 작성하세요..."
            required
          />
        </div>
      </div>
    </form>
  );
}
