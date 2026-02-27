"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPage, savePage } from "../../actions";

export function HomeEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPage("home").then((result) => {
      if ("page" in result && result.page) {
        setTitle(result.page.title || "");
        setHeadline(result.page.content || "");
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const result = await savePage("home", headline, title);
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
              홈 페이지 편집
            </h1>
            <p className="mt-0.5 text-sm text-charcoal-500 dark:text-charcoal-400">
              메인 페이지의 타이틀과 헤드라인을 수정합니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          저장하면 메인 페이지에 바로 반영됩니다. 비워두면 기본값이 표시됩니다.
        </p>
      </div>

      {/* Editor Card */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="flex items-center gap-2 border-b border-charcoal-100 px-6 py-4 dark:border-charcoal-700/50">
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
              d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
            홈 설정
          </h2>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              타이틀
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Orbit42"
              className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
              헤드라인
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="기술, 농업, 그리고 그 사이의 모든 것에 대한 블로그"
              className="w-full rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-3 text-charcoal-900 transition-all placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="flex items-center gap-2 border-b border-charcoal-100 px-6 py-4 dark:border-charcoal-700/50">
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
              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
            미리보기
          </h2>
        </div>
        <div className="p-6">
          <h3 className="mb-2 text-3xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
            {title || "Orbit42"}
          </h3>
          <p className="text-lg text-charcoal-600 dark:text-charcoal-400">
            {headline || "기술, 농업, 그리고 그 사이의 모든 것에 대한 블로그"}
          </p>
        </div>
      </div>
    </div>
  );
}
