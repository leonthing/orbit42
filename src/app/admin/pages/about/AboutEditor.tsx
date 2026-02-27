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

  if (loading) return <p className="text-charcoal-500">로딩 중...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal-900 dark:text-charcoal-100">
          About 페이지 편집
        </h1>
        <div className="flex items-center gap-3">
          {message && (
            <span
              className={`text-sm ${message.includes("저장") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
            >
              {message}
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-charcoal-300 px-4 py-2 text-sm text-charcoal-600 transition-colors hover:bg-charcoal-100 dark:border-charcoal-600 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
          >
            돌아가기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
        마크다운으로 작성하세요. 저장하면 /about 페이지에 바로 반영됩니다.
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={25}
        className="w-full rounded-lg border border-charcoal-300 bg-white px-4 py-3 font-mono text-sm text-charcoal-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-100"
        placeholder="## About&#10;&#10;마크다운으로 자기소개를 작성하세요..."
      />
    </div>
  );
}
