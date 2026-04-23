"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow } from "@/lib/follows";
import { useToast } from "@/components/Toast";
import { buttonClasses, type ButtonSize } from "@/components/PendingButton";

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
  const toast = useToast();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  const size: ButtonSize = compact ? "sm" : "md";

  if (!loggedIn) {
    return (
      <a href="/login" className={buttonClasses({ variant: "primary", size })}>
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
        toast.error(res.error);
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
      className={buttonClasses({ variant: following ? "secondary" : "primary", size })}
    >
      {following ? "Orbiting" : "Orbit"}
    </button>
  );
}
