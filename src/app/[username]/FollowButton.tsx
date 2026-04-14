"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow } from "@/lib/follows";

export function FollowButton({
  targetUsername,
  initiallyFollowing,
  loggedIn,
}: {
  targetUsername: string;
  initiallyFollowing: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <a
        href="/login"
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
      >
        Sign in to orbit
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
      className={
        following
          ? "rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-200 hover:border-red-500/60 hover:text-red-400"
          : "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
      }
    >
      {following ? "Orbiting" : "Orbit"}
    </button>
  );
}
