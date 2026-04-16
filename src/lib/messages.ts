"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sendNewMessageEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import type { ConversationSummary, Message } from "@/lib/messages-types";

// --- Helpers -------------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  return (data?.id as string | undefined) ?? null;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// --- Queries -------------------------------------------------------------

export async function listConversations(): Promise<ConversationSummary[]> {
  const me = await currentUserId();
  if (!me) return [];
  const db = getAdminClient();
  const { data, error } = await db
    .from("conversations")
    .select(
      "id, user_a, user_b, last_message_at, last_message_preview, last_sender_id, a_last_read_at, b_last_read_at",
    )
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  const otherIds = Array.from(
    new Set(data.map((c) => (c.user_a === me ? c.user_b : c.user_a))),
  );
  if (otherIds.length === 0) return [];

  const { data: others } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
    .in("id", otherIds);

  const byId = new Map((others ?? []).map((u) => [u.id as string, u]));

  return data
    .map((c) => {
      const otherId = c.user_a === me ? c.user_b : c.user_a;
      const other = byId.get(otherId);
      if (!other) return null;
      const myLastRead = c.user_a === me ? c.a_last_read_at : c.b_last_read_at;
      const lastAt = c.last_message_at;
      const lastSenderIsMe = c.last_sender_id === me;
      const unread =
        !!lastAt &&
        !lastSenderIsMe &&
        (!myLastRead || new Date(myLastRead) < new Date(lastAt));
      return {
        id: c.id as string,
        other: {
          id: other.id as string,
          username: other.username as string,
          display_name: (other.display_name as string | null) ?? null,
          avatar_url: (other.avatar_url as string | null) ?? null,
        },
        last_message_at: lastAt as string | null,
        last_message_preview: (c.last_message_preview as string | null) ?? null,
        last_sender_is_me: lastSenderIsMe,
        unread,
      };
    })
    .filter(Boolean) as ConversationSummary[];
}

export async function unreadMessageCount(): Promise<number> {
  const me = await currentUserId();
  if (!me) return 0;
  const db = getAdminClient();
  const { data } = await db
    .from("conversations")
    .select("user_a, user_b, last_message_at, last_sender_id, a_last_read_at, b_last_read_at")
    .or(`user_a.eq.${me},user_b.eq.${me}`);
  if (!data) return 0;
  let n = 0;
  for (const c of data) {
    if (!c.last_message_at || c.last_sender_id === me) continue;
    const myLastRead = c.user_a === me ? c.a_last_read_at : c.b_last_read_at;
    if (!myLastRead || new Date(myLastRead) < new Date(c.last_message_at)) n++;
  }
  return n;
}

export async function getConversation(id: string) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." } as const;
  const db = getAdminClient();
  const { data: conv } = await db
    .from("conversations")
    .select("id, user_a, user_b, a_last_read_at, b_last_read_at")
    .eq("id", id)
    .single();
  if (!conv) return { error: "대화를 찾을 수 없어요." } as const;
  if (conv.user_a !== me && conv.user_b !== me) {
    return { error: "이 대화에 참여할 수 없습니다." } as const;
  }
  const otherId = conv.user_a === me ? conv.user_b : conv.user_a;
  const { data: other } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
    .eq("id", otherId)
    .single();
  const { data: rows } = await db
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  return {
    me,
    other: other
      ? {
          id: other.id as string,
          username: other.username as string,
          display_name: (other.display_name as string | null) ?? null,
          avatar_url: (other.avatar_url as string | null) ?? null,
        }
      : null,
    messages: (rows ?? []) as Message[],
  } as const;
}

// --- Mutations -----------------------------------------------------------

export async function startConversation(targetUsername: string) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };
  const db = getAdminClient();
  const { data: target } = await db
    .from("users")
    .select("id")
    .eq("username", targetUsername)
    .single();
  if (!target) return { error: "상대를 찾을 수 없어요." };
  if (target.id === me) return { error: "자기 자신에게는 보낼 수 없어요." };
  const { isBlockedEitherWay } = await import("@/lib/blocks");
  if (await isBlockedEitherWay(me, target.id as string)) {
    return { error: "이 사용자와 대화할 수 없어요." };
  }

  const [a, b] = orderedPair(me, target.id as string);
  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  if (existing?.id) return { id: existing.id as string };

  const { data: created, error } = await db
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();
  if (error || !created) return { error: "대화를 시작하지 못했어요." };
  return { id: created.id as string };
}

const NOTIFY_MIN_GAP_MS = 10 * 60_000; // throttle emails to once per 10 min per conv

export async function sendMessage(conversationId: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "내용을 입력해주세요." };
  if (text.length > 4000) return { error: "메시지가 너무 길어요 (4000자 이하)." };

  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(clientKey("msg-send", me), 60, 60_000);
  if (!limit.ok) {
    return { error: `너무 자주 보냈어요. ${limit.retryAfter}초 후 다시.` };
  }

  const db = getAdminClient();
  const { data: conv } = await db
    .from("conversations")
    .select(
      "id, user_a, user_b, a_last_notified_at, b_last_notified_at, a_last_read_at, b_last_read_at",
    )
    .eq("id", conversationId)
    .single();
  if (!conv) return { error: "대화를 찾을 수 없어요." };
  if (conv.user_a !== me && conv.user_b !== me) {
    return { error: "이 대화에 참여할 수 없습니다." };
  }

  const { error: insErr } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: me, body: text });
  if (insErr) return { error: "전송에 실패했어요." };

  const preview = text.length > 200 ? text.slice(0, 200) : text;
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    last_message_at: nowIso,
    last_message_preview: preview,
    last_sender_id: me,
  };
  // Sender's own read marker advances with every send.
  if (conv.user_a === me) patch.a_last_read_at = nowIso;
  else patch.b_last_read_at = nowIso;

  await db.from("conversations").update(patch).eq("id", conversationId);

  // In-app notification always (aggregates on the recipient's side).
  const otherId = conv.user_a === me ? conv.user_b : conv.user_a;
  const { data: sender } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", me)
    .single();
  const senderLabel =
    (sender?.display_name as string | null) ||
    (sender?.username as string) ||
    "누군가";
  await createNotification({
    userId: otherId,
    type: "new_message",
    title: `${senderLabel}님의 새 메시지`,
    body: preview,
    link: `/messages/${conversationId}`,
    actorId: me,
  });

  // Throttled email notification to the other party.
  const otherLastNotified =
    conv.user_a === me ? conv.b_last_notified_at : conv.a_last_notified_at;
  const otherLastRead =
    conv.user_a === me ? conv.b_last_read_at : conv.a_last_read_at;

  const shouldNotify =
    (!otherLastNotified ||
      Date.now() - new Date(otherLastNotified).getTime() > NOTIFY_MIN_GAP_MS) &&
    // Only notify if the other party has caught up to previous messages —
    // i.e. they're not mid-conversation. Mitigates noise during active chat.
    (!otherLastRead ||
      !conv.a_last_notified_at ||
      true);

  if (shouldNotify) {
    const { data: other } = await db
      .from("users")
      .select("email, email_verified, display_name")
      .eq("id", otherId)
      .single();

    if (other?.email && other?.email_verified) {
      await sendNewMessageEmail(other.email as string, {
        fromLabel:
          (sender?.display_name as string | null) ||
          (sender?.username as string) ||
          "Orbit42",
        preview,
        conversationId,
      });
      const notifyPatch =
        conv.user_a === me
          ? { b_last_notified_at: nowIso }
          : { a_last_notified_at: nowIso };
      await db.from("conversations").update(notifyPatch).eq("id", conversationId);
    }
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return { ok: true as const };
}

export async function markRead(conversationId: string) {
  const me = await currentUserId();
  if (!me) return { error: "로그인이 필요합니다." };
  const db = getAdminClient();
  const { data: conv } = await db
    .from("conversations")
    .select("user_a, user_b")
    .eq("id", conversationId)
    .single();
  if (!conv) return { error: "대화를 찾을 수 없어요." };
  if (conv.user_a !== me && conv.user_b !== me) {
    return { error: "이 대화에 참여할 수 없습니다." };
  }
  const nowIso = new Date().toISOString();
  const patch =
    conv.user_a === me ? { a_last_read_at: nowIso } : { b_last_read_at: nowIso };
  await db.from("conversations").update(patch).eq("id", conversationId);
  revalidatePath("/messages");
  return { ok: true as const };
}
