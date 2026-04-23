"use client";

import { useEffect, useState } from "react";

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function SidebarClock() {
  const now = useNow();
  if (!now) {
    return (
      <div className="px-3 pb-2 pt-3" suppressHydrationWarning>
        <div className="h-4 w-24 rounded bg-charcoal-800/30" />
        <div className="mt-1.5 h-3 w-16 rounded bg-charcoal-800/20" />
      </div>
    );
  }
  const dateLine = now.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeLine = now.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return (
    <div className="px-3 pb-2 pt-3" suppressHydrationWarning>
      <p className="text-xs font-semibold text-charcoal-200">{dateLine}</p>
      <p className="font-mono text-[11px] tabular-nums text-charcoal-500">
        {timeLine}
      </p>
    </div>
  );
}
