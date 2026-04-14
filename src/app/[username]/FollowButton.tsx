"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow } from "@/lib/follows";

export function FollowButton({
  targetUsername,
  initiallyFollowing,
  loggedIn,
  compact = false,
}: {
  targetUsername: string;
  initiallyFollowing: boolean;
  loggedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  const sizeClass = compact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";

  if (!loggedIn) {
    return (
      <a
        href="/login"
        className={`shrink-0 rounded-md bg-red-600 font-semibold text-white hover:bg-red-500 ${sizeClass}`}
      >
        {compact ? "Orbit" : "Sign in to orbit"}
      </a>
    );
  }

  const handle = () => {
    startTransition(async () => {
      const next = !following;
      setFollowing(next);
      const res = next ? await follow(targetUsername) : await unfollow(targetUsername);
      if (res.error) {
        setFollowing(!next);
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className={`shrink-0 rounded-md font-semibold ${sizeClass} ${
        following
          ? "border border-charcoal-700 text-charcoal-700 hover:border-red-500/60 hover:text-red-500 dark:text-charcoal-200 dark:hover:text-red-400"
          : "bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
      }`}
    >
      {following ? "Orbiting" : "Orbit"}
    </button>
  );
}
