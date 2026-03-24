"use client";

import { useState, useTransition } from "react";
import type { LifeMemory } from "./life-actions";
import { createLifeMemory, updateLifeMemory, deleteLifeMemory } from "./life-actions";

const LIFE_YEARS = 100;
const WEEKS_PER_YEAR = 52;
const DOT = 10;
const GAP = 2;

type SelectedWeek = { year: number; week: number } | null;

export default function LifeCalendarView({
  birthDate,
  initialMemories,
}: {
  birthDate?: string | null;
  initialMemories: LifeMemory[];
}) {
  const [selected, setSelected] = useState<SelectedWeek>(null);
  const [memories, setMemories] = useState<LifeMemory[]>(initialMemories);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!birthDate) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
        <svg className="h-12 w-12 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="mt-4 text-sm text-charcoal-400">Life Calendar를 보려면 생년월일을 설정해주세요</p>
        <p className="mt-1 text-xs text-charcoal-600">Settings에서 생년월일을 입력할 수 있습니다</p>
      </div>
    );
  }

  const birth = new Date(birthDate);
  const now = new Date();
  const birthYear = birth.getFullYear();
  const endYear = birthYear + LIFE_YEARS;

  const getWeekOfYear = (d: Date): number => {
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  };

  const birthWeek = getWeekOfYear(birth);
  const nowYear = now.getFullYear();
  const nowWeek = getWeekOfYear(now);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksLived = Math.floor((now.getTime() - birth.getTime()) / msPerWeek);
  const totalWeeks = LIFE_YEARS * WEEKS_PER_YEAR;

  // Memory lookup: multiple memories per week
  const memoryMap = new Map<string, LifeMemory[]>();
  for (const m of memories) {
    const key = `${m.year}-${m.week}`;
    const arr = memoryMap.get(key) || [];
    arr.push(m);
    memoryMap.set(key, arr);
  }

  const getMemories = (yr: number, w: number) => memoryMap.get(`${yr}-${w}`) || [];
  const hasMemories = (yr: number, w: number) => memoryMap.has(`${yr}-${w}`);
  const selectedMemories = selected ? getMemories(selected.year, selected.week) : [];

  const handleSelect = (yr: number, w: number) => {
    const isBeforeBirth = yr === birthYear && w < birthWeek;
    if (isBeforeBirth) return;

    if (selected?.year === yr && selected?.week === w) {
      setSelected(null);
      setIsEditing(false);
      setEditingId(null);
    } else {
      setSelected({ year: yr, week: w });
      setIsEditing(false);
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
    }
  };

  const handleCreate = () => {
    if (!selected || !editTitle.trim()) return;
    startTransition(async () => {
      const saved = await createLifeMemory(selected.year, selected.week, editTitle.trim(), editContent.trim());
      setMemories((prev) => [...prev, saved]);
      setIsEditing(false);
      setEditTitle("");
      setEditContent("");
    });
  };

  const handleUpdate = () => {
    if (!editingId || !editTitle.trim()) return;
    startTransition(async () => {
      const saved = await updateLifeMemory(editingId, editTitle.trim(), editContent.trim());
      setMemories((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      setIsEditing(false);
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteLifeMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    });
  };

  const startEdit = (mem: LifeMemory) => {
    setEditingId(mem.id);
    setEditTitle(mem.title);
    setEditContent(mem.content || "");
    setIsEditing(true);
  };

  const startNew = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setIsEditing(true);
  };

  const getAge = (yr: number) => yr - birthYear;
  const getDateRange = (yr: number, w: number) => {
    const start = new Date(yr, 0, 1 + w * 7);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(start)} ~ ${fmt(end)}`;
  };

  const cellSize = DOT + GAP;

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {/* Life Grid */}
      <div className="shrink-0 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-4 md:px-4 md:py-5">
        {/* Header */}
        <div className="mb-3 md:mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-charcoal-100 sm:text-sm">YOUR LIFE IN WEEKS</h2>
              <p className="mt-0.5 text-[10px] text-charcoal-500">
                {weeksLived.toLocaleString()} lived · {Math.max(0, totalWeeks - weeksLived).toLocaleString()} remaining
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-charcoal-500 sm:gap-3">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Born</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-navy-400" />Lived</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Now</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />Memory</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full border border-charcoal-700" />Future</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ display: "inline-block" }}>
            {/* Week header */}
            <div className="flex" style={{ paddingLeft: 32 }}>
              {Array.from({ length: WEEKS_PER_YEAR }, (_, w) => (
                <div key={w} style={{ width: cellSize, height: 14 }} className="flex items-end justify-center">
                  {w % 4 === 0 && <span className="text-[8px] leading-none text-charcoal-600">{w + 1}</span>}
                </div>
              ))}
            </div>

            {/* Rows */}
            {Array.from({ length: LIFE_YEARS }, (_, ri) => {
              const i = LIFE_YEARS - 1 - ri;
              const yr = birthYear + i;
              const isCurrentYear = yr === nowYear;
              const isDecade = yr % 10 === 0;

              return (
                <div key={yr} className="flex items-center" style={{ height: cellSize }}>
                  {/* Year label */}
                  <div className="shrink-0 text-right pr-1" style={{ width: 30 }}>
                    {(i === 0 || i % 5 === 0 || isCurrentYear) && (
                      <span className={`text-[8px] leading-none ${isCurrentYear ? "font-bold text-navy-400" : isDecade ? "text-charcoal-400" : "text-charcoal-600"}`}>
                        {yr}
                      </span>
                    )}
                  </div>

                  {/* Dots */}
                  {Array.from({ length: WEEKS_PER_YEAR }, (_, w) => {
                    const isBeforeBirth = yr === birthYear && w < birthWeek;
                    const isBirth = yr === birthYear && w === birthWeek;
                    const isCurrent = yr === nowYear && w === nowWeek;
                    const weekDate = new Date(yr, 0, 1 + w * 7);
                    const isLived = !isBeforeBirth && !isBirth && !isCurrent && weekDate < now;
                    const hasMemory = hasMemories(yr, w);
                    const isSelected = selected?.year === yr && selected?.week === w;

                    let cls = "";
                    if (isBeforeBirth) {
                      cls = "bg-transparent";
                    } else if (isSelected) {
                      cls = "bg-white ring-1 ring-white ring-offset-1 ring-offset-[#0a0a0f]";
                    } else if (isBirth) {
                      cls = "bg-amber-400";
                    } else if (isCurrent) {
                      cls = "bg-emerald-400";
                    } else if (hasMemory) {
                      cls = "bg-violet-400";
                    } else if (isLived) {
                      cls = "bg-navy-500/50";
                    } else {
                      cls = "border border-charcoal-800/60 bg-transparent";
                    }

                    return (
                      <div
                        key={w}
                        onClick={() => !isBeforeBirth && handleSelect(yr, w)}
                        className={`rounded-full cursor-pointer hover:ring-1 hover:ring-charcoal-500 ${cls}`}
                        style={{ width: DOT, height: DOT, margin: GAP / 2 }}
                        title={isBeforeBirth ? "" : `${yr}년 ${w + 1}주차`}
                      />
                    );
                  })}

                  {/* Age */}
                  <div className="shrink-0 pl-1.5" style={{ width: 28 }}>
                    {(i === 0 || i % 10 === 0 || isCurrentYear) && (
                      <span className={`text-[8px] leading-none ${isCurrentYear ? "font-bold text-navy-400" : "text-charcoal-600"}`}>
                        {i}세
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3 flex items-center gap-2 md:mt-4 md:gap-3">
          <span className="text-[10px] text-charcoal-600">{birthYear}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-charcoal-800">
            <div className="h-full rounded-full bg-gradient-to-r from-navy-600 to-navy-400" style={{ width: `${Math.min(100, (weeksLived / totalWeeks) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-charcoal-500">{Math.round((weeksLived / totalWeeks) * 100)}%</span>
          <span className="text-[10px] text-charcoal-600">{endYear}</span>
        </div>
      </div>

      {/* Memory Panel */}
      <div className="min-w-0 flex-1 space-y-4 lg:sticky lg:top-5 lg:self-start">
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
          {selected ? (
            <>
              <div className="border-b border-charcoal-800/40 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-charcoal-200">
                      {selected.year}년 {selected.week + 1}주차
                    </h3>
                    <p className="mt-0.5 text-xs text-charcoal-500">
                      {getAge(selected.year)}세 · {getDateRange(selected.year, selected.week)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        onClick={startNew}
                        className="rounded-lg px-2 py-1 text-xs text-navy-400 hover:bg-navy-600/10"
                      >
                        + 추가
                      </button>
                    )}
                    <button
                      onClick={() => { setSelected(null); setIsEditing(false); setEditingId(null); }}
                      className="rounded-lg p-1 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {/* Edit / Create form */}
                {isEditing && (
                  <div className="mb-4 space-y-3 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 p-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="제목"
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
                      autoFocus
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="이 주에 대한 기억을 기록하세요..."
                      rows={4}
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { setIsEditing(false); setEditingId(null); }}
                        className="rounded-lg px-3 py-1.5 text-xs text-charcoal-500 hover:text-charcoal-300"
                      >
                        취소
                      </button>
                      <button
                        onClick={editingId ? handleUpdate : handleCreate}
                        disabled={isPending || !editTitle.trim()}
                        className="rounded-lg bg-navy-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-navy-500 disabled:opacity-40"
                      >
                        {isPending ? "저장 중..." : editingId ? "수정" : "저장"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Memory list */}
                {selectedMemories.length > 0 ? (
                  <div className="space-y-3">
                    {selectedMemories.map((mem) => (
                      <div key={mem.id} className="group rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium text-charcoal-100">{mem.title}</h4>
                          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(mem)}
                              className="rounded p-1 text-charcoal-500 hover:text-charcoal-300"
                              title="수정"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              disabled={isPending}
                              className="rounded p-1 text-charcoal-500 hover:text-red-400"
                              title="삭제"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {mem.content && (
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-charcoal-400">
                            {mem.content}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] text-charcoal-600">
                          {new Date(mem.created_at).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : !isEditing ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-charcoal-500">기록이 없습니다</p>
                    <button
                      onClick={startNew}
                      className="mt-3 rounded-lg bg-navy-600 px-4 py-2 text-xs font-medium text-white hover:bg-navy-500"
                    >
                      기억 기록하기
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-8 sm:py-12">
              <svg className="h-8 w-8 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="mt-3 text-sm text-charcoal-500">주를 선택하세요</p>
              <p className="mt-1 text-xs text-charcoal-600">점을 클릭하면 기억을 기록할 수 있습니다</p>
            </div>
          )}
        </div>

        {/* Memory count */}
        {memories.length > 0 && (
          <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-4 py-3 sm:px-5">
            <p className="text-xs text-charcoal-500">
              <span className="font-medium text-violet-400">{memories.length}</span>개의 기억이 기록되어 있습니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
