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
    return <p className="text-charcoal-500">로딩 중...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
          {isNew ? "새 글 작성" : "글 수정"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-charcoal-300 px-4 py-2 text-sm text-charcoal-600 transition-colors hover:bg-charcoal-100 dark:border-charcoal-600 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || !title || !content}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
          placeholder="글 제목"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          슬러그
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-sm text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
          placeholder="url-slug"
          readOnly={!isNew}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          설명
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
          placeholder="글에 대한 짧은 설명"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
            카테고리
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
          >
            {CATEGORIES.filter((c) => c !== "All").map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
            태그 (쉼표 구분)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-2 text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
            placeholder="Next.js, React, 블로그"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          내용 (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-3 font-mono text-sm text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
          placeholder="마크다운으로 글을 작성하세요..."
          required
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="h-4 w-4 rounded border-charcoal-300 text-navy-600 focus:ring-navy-500"
        />
        <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          공개
        </span>
      </label>
    </form>
  );
}
