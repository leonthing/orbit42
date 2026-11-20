"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 휴대폰 설정은 목록 → 하위 화면(?tab=…)이라, 예전 링크(설정#google, #payment, #bio …)로 들어오면
 * 숨은 구역으로 간다. 해시가 든 구역을 찾아 ?tab= 으로 바꿔 준다(데스크톱은 그대로 해시 스크롤).
 */
export function HashToTab() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const hash = window.location.hash.slice(1);
    if (!hash || params.get("tab")) return;
    const el = document.getElementById(hash);
    const section = el?.closest("section[id]") as HTMLElement | null;
    const tab = section?.id ?? hash;
    const q = new URLSearchParams(params.toString());
    q.set("tab", tab);
    router.replace(`${pathname}?${q.toString()}#${hash}`);
  }, [router, pathname, params]);
  return null;
}
