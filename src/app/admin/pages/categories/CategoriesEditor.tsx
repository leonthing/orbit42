"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCategories, saveCategories } from "../../actions";

export function CategoriesEditor() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  const handleAdd = () => {
    const name = newCategory.trim();
    if (!name || categories.includes(name)) return;
    setCategories([...categories, name]);
    setNewCategory("");
  };

  const handleRemove = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const result = await saveCategories(categories);
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
          <svg className="h-8 w-8 animate-spin text-navy-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-charcoal-500 dark:text-charcoal-400">로딩 중...</p>
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
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal-900 dark:text-charcoal-100">
              카테고리 관리
            </h1>
            <p className="mt-0.5 text-sm text-charcoal-500 dark:text-charcoal-400">
              글 작성 시 선택할 수 있는 카테고리를 관리합니다
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
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* Editor Card */}
      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm dark:border-charcoal-700 dark:bg-charcoal-800/80">
        <div className="flex items-center gap-2 border-b border-charcoal-100 px-6 py-4 dark:border-charcoal-700/50">
          <svg className="h-4 w-4 text-charcoal-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
          <h2 className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-300">
            카테고리 목록
          </h2>
        </div>
        <div className="p-6">
          {/* Add new */}
          <div className="mb-5 flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
              placeholder="새 카테고리 이름"
              className="flex-1 rounded-xl border border-charcoal-200 bg-charcoal-50 px-4 py-2.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20 dark:border-charcoal-600 dark:bg-charcoal-900/50 dark:text-charcoal-100 dark:placeholder:text-charcoal-500 dark:focus:bg-charcoal-900"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newCategory.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              추가
            </button>
          </div>

          {/* List */}
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-charcoal-500 dark:text-charcoal-400">
              카테고리가 없습니다. 새 카테고리를 추가하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between rounded-lg border border-charcoal-200 bg-charcoal-50 px-4 py-3 dark:border-charcoal-600 dark:bg-charcoal-900/50"
                >
                  <span className="text-sm font-medium text-charcoal-900 dark:text-charcoal-100">
                    {cat}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded p-1 text-charcoal-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="삭제"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
