"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startConversation } from "@/lib/messages";
import { useToast } from "@/components/Toast";
import { buttonClasses } from "@/components/PendingButton";

export function MessageButton({
  targetUsername,
  loggedIn,
}: {
  targetUsername: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setPending(true);
    const res = await startConversation(targetUsername);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error ?? "메시지를 열 수 없어요.");
      return;
    }
    router.push(`/messages/${res.id}`);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={buttonClasses({ variant: "secondary", size: "md" })}
    >
      {pending ? "여는 중…" : "메시지"}
    </button>
  );
}
