"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export type FeedbackItem = {
  id: string;
  body: string;
  email: string | null;
  path: string | null;
  user_agent: string | null;
  created_at: string;
  resolved_at: string | null;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function submitFeedback(args: {
  body: string;
  email?: string | null;
  path?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const body = args.body.trim();
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 4000) return { error: "4000자를 넘을 수 없어요." };

  const session = await getSession();
  const keyId = session?.username ?? clientKey("feedback");
  const limit = rateLimit(`feedback:${keyId}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return { error: `너무 많이 보냈어요. ${limit.retryAfter}초 후에 다시 시도해주세요.` };
  }

  const db = getAdminClient();

  let userId: string | null = null;
  let userEmail: string | null = null;
  let userDisplay: { username: string; displayName: string | null } | null = null;
  if (session) {
    const { data } = await db
      .from("users")
      .select("id, email, username, display_name")
      .eq("username", session.username)
      .single();
    if (data) {
      userId = data.id as string;
      userEmail = (data.email as string | null) ?? null;
      userDisplay = {
        username: data.username as string,
        displayName: (data.display_name as string | null) ?? null,
      };
    }
  }

  const submittedEmail =
    (args.email ?? "").trim().toLowerCase() || null;
  const effectiveEmail = submittedEmail || userEmail;

  const h = headers();
  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;
  const path = (args.path ?? "").slice(0, 500) || null;

  const { data: inserted, error } = await db
    .from("feedback")
    .insert({
      user_id: userId,
      email: effectiveEmail,
      body,
      path,
      user_agent: userAgent,
    })
    .select("id")
    .single();
  if (error) {
    console.error("feedback insert", error);
    return { error: "저장에 실패했어요." };
  }

  // Best-effort: email the admin inbox + in-app notify admin user(s).
  try {
    const { sendFeedbackEmail } = await import("@/lib/email");
    await sendFeedbackEmail({
      body,
      path,
      from: {
        username: userDisplay?.username ?? null,
        displayName: userDisplay?.displayName ?? null,
        email: effectiveEmail,
      },
    });
  } catch (err) {
    console.error("feedback email", err);
  }

  try {
    const adminList = (process.env.ADMIN_USERNAMES || "leokim5854")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const { data: admins } = await db
      .from("users")
      .select("id")
      .in("username", adminList);
    if (admins && admins.length > 0) {
      const { createNotification } = await import("@/lib/notifications");
      const label =
        userDisplay?.displayName ||
        userDisplay?.username ||
        "익명";
      for (const a of admins) {
        await createNotification({
          userId: a.id as string,
          type: "invite_used", // reuse neutral type; dedicated one later
          title: `피드백: ${label}`,
          body: body.slice(0, 120),
          link: "/admin/feedback",
          actorId: userId,
        });
      }
    }
  } catch (err) {
    console.error("feedback notify", err);
  }

  void inserted;
  revalidatePath("/admin/feedback");
  return { ok: true };
}

export async function listFeedback(): Promise<FeedbackItem[]> {
  const admin = await requireAdmin();
  if (!admin) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("feedback")
    .select(
      "id, body, email, path, user_agent, created_at, resolved_at, user:users!feedback_user_id_fkey(username, display_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    body: r.body as string,
    email: (r.email as string | null) ?? null,
    path: (r.path as string | null) ?? null,
    user_agent: (r.user_agent as string | null) ?? null,
    created_at: r.created_at as string,
    resolved_at: (r.resolved_at as string | null) ?? null,
    user: (r.user as FeedbackItem["user"]) ?? null,
  }));
}

export async function toggleFeedbackResolved(id: string, resolved: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };
  const db = getAdminClient();
  const { error } = await db
    .from("feedback")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "업데이트 실패" };
  revalidatePath("/admin/feedback");
  return { ok: true as const };
}
