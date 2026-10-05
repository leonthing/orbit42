"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ORBIT_LIMIT,
  metOrNextLabel,
  type OrbitPerson,
} from "@/lib/people-types";
import { PersonAvatar } from "./PersonAvatar";

/** 궤도마다 첫 사람의 각도 — 겹치지 않게 조금씩 비튼다 (Clique 와 같은 값) */
const RING_OFFSETS = [-90, -60, -120];

/**
 * 나를 가운데 두고, 최근에 만난 사람일수록 안쪽 궤도에 놓는다.
 * Clique 의 OrbitView 를 웹으로 옮긴 것 — 궤도 3개, 최대 ORBIT_LIMIT 명.
 */
export function OrbitCanvas({
  people,
  me,
  hrefFor,
  addSlot,
}: {
  people: OrbitPerson[];
  me: { name: string; avatarUrl: string | null };
  hrefFor: (p: OrbitPerson) => string;
  addSlot?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [appeared, setAppeared] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    const t = setTimeout(() => setAppeared(true), 60);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  const shown = people.slice(0, ORBIT_LIMIT);
  const hidden = Math.max(0, people.length - shown.length);
  // 바깥 궤도 + 아바타 반 + 라벨이 카드 안에 들어오게
  const outer = Math.min(width / 2 - 44, 168);
  const radii = [outer * 0.52, outer * 0.77, outer];
  const nodeSize = shown.length <= 4 ? 52 : shown.length <= 8 ? 44 : 38;
  const cx = width / 2;
  // 위쪽 사람은 라벨이 아바타 위에 붙으므로 바깥 궤도 + 아바타 반 + 라벨만큼 위를 비운다.
  const CENTER_Y = Math.round(outer + nodeSize / 2 + 42);
  const HEIGHT = CENTER_Y * 2;

  const byRing = new Map<number, OrbitPerson[]>();
  for (const p of shown) {
    const list = byRing.get(p.ring) ?? [];
    list.push(p);
    byRing.set(p.ring, list);
  }
  const placed: Array<{ p: OrbitPerson; x: number; y: number; above: boolean }> = [];
  byRing.forEach((members, ring) => {
    const step = 360 / members.length;
    members.forEach((p, i) => {
      const a = ((RING_OFFSETS[ring] + step * i) * Math.PI) / 180;
      const r = appeared ? radii[ring] : 0;
      placed.push({ p, x: cx + r * Math.cos(a), y: CENTER_Y + r * Math.sin(a), above: Math.sin(a) < 0 });
    });
  });

  const caption =
    people.length === 0
      ? "오른쪽 위 +로 사람을 더하거나, 캘린더에서 찾아보세요"
      : hidden > 0
        ? `최근에 만났을수록 가까이 · 외 ${hidden}명은 아래 목록에서`
        : "최근에 만났을수록 나와 가까이 있어요";

  return (
    <div className="relative rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] px-3 pb-4 pt-2">
      {addSlot && <div className="absolute right-3 top-3 z-10">{addSlot}</div>}
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        {radii.map((r, i) => (
          <span
            key={i}
            className={`absolute rounded-full border ${
              i === 2 ? "border-dashed" : ""
            } border-charcoal-800/70`}
            style={{ width: r * 2, height: r * 2, left: cx - r, top: CENTER_Y - r }}
          />
        ))}

        {/* 나 */}
        <span
          className="absolute flex items-center justify-center rounded-full p-1 shadow-lg ring-4 ring-navy-400/40"
          style={{ left: cx - 34, top: CENTER_Y - 34, width: 68, height: 68, background: "rgb(var(--bg-surface))" }}
          title="나"
        >
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-navy-500 to-navy-400 text-lg font-bold text-white">
            {me.avatarUrl ? (
              <Image src={me.avatarUrl} alt={me.name} fill sizes="60px" className="object-cover" unoptimized />
            ) : (
              "나"
            )}
          </span>
        </span>

        {placed.map(({ p, x, y, above }) => {
          const label = (
            <span className="flex h-8 flex-col items-center leading-tight">
              <span className="max-w-[84px] truncate text-2xs font-semibold text-charcoal-100">{p.name}</span>
              <span className="text-3xs text-charcoal-500">{metOrNextLabel(p)}</span>
            </span>
          );
          return (
            <Link
              key={p.id}
              href={hrefFor(p)}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1 transition-[left,top] duration-700 ease-[cubic-bezier(.2,.9,.3,1.15)] hover:z-10 focus-visible:outline-none"
              style={{
                left: x,
                top: above ? y - nodeSize / 2 - 36 : y - nodeSize / 2,
              }}
              aria-label={`${p.name}, ${metOrNextLabel(p)}`}
            >
              {above && label}
              <PersonAvatar
                person={p}
                size={nodeSize}
                className="ring-[3px] ring-[rgb(var(--bg-surface))] transition-transform hover:scale-110"
              />
              {!above && label}
            </Link>
          );
        })}
      </div>
      <p className="text-center text-xs text-charcoal-500">{caption}</p>
    </div>
  );
}
