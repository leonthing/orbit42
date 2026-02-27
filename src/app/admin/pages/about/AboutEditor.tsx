"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPage, savePage } from "../../actions";

export function AboutEditor() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPage("about").then((result) => {
      if ("page" in result && result.page) {
        setContent(result.page.content);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const result = await savePage("about", content, "About");
    if ("error" in result && result.error) {
      setMessage(result.error);
    } else {
      setMessage("저장되었습니다!");
      setTimeout(() => setMessage(""), 2000);
    }
    setSaving(false);
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
    <div className="space-y-6">
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
              About 페이지 편집
            </h1>
            <p className="mt-0.5 text-sm text-charcoal-500 dark:text-charcoal-400">
              /about 페이지에 표시되는 내용을 수정합니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Save status message */}
          {message && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                message.includes("저장")
                  ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                  : "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400"
              }`}
            >
              {message.includes("저장") ? (
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
              ) : (
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
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              )}
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-charcoal-200 bg-white px-5 py-2.5 text-sm font-medium text-charcoal-600 shadow-sm transition-all hover:bg-charcoal-50 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
          >
            돌아가기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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

      {/* Info callout */}
      <div className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3 dark:border-navy-900 dark:bg-navy-950/30">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-navy-500 dark:text-navy-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
        <p className="text-sm text-navy-700 dark:text-navy-300">
          마크다운으로 작성하세요. 저장하면 <code className="rounded bg-navy-100 px-1.5 py-0.5 font-mono text-xs dark:bg-navy-900">/about</code> 페이지에 바로 반영됩니다.
        </p>
      </div>

      {/* Editor Card */}
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
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
              About 내용
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
            rows={28}
            className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 font-mono text-sm leading-relaxed text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            placeholder="## About&#10;&#10;마크다운으로 자기소개를 작성하세요..."
          />
        </div>
      </div>
    </div>
  );
}
