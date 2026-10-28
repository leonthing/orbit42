"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { DEMO_USERNAMES, hidesDemoInCounts } from "@/lib/demo-visibility";

async function getUserIdByUsername(username: string): Promise<string | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  return data?.id ?? null;
}

/**
 * 팔로워·팔로잉 수.
 * opts.viewer 를 주면 그 사람이 보는 기준으로 센다(null = 로그인 안 한 방문자) — 본인이 아니고 내부 계정도 아니면
 * 데모·시험 계정(appreview·leotaurus13)과의 팔로우는 빼서 팔로잉·팔로워 목록(데모 숨김, 개선-33)과 숫자를 맞춘다.
 * 웹은 쿠키 세션, 앱 API 는 토큰 세션의 아이디를 넘긴다. 팔로우 행 자체는 그대로 둔다.
 */
export async function getFollowStats(username: string, opts?: { viewer: string | null }) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return { followers: 0, following: 0 };

  let demoIds: string[] = [];
  if (opts && hidesDemoInCounts(username, opts.viewer)) {
    const { data } = await db.from("users").select("id").in("username", Array.from(DEMO_USERNAMES));
    demoIds = (data ?? []).map((u) => u.id as string).filter((id) => id !== userId);
  }
  const notIn = `(${demoIds.join(",")})`;

  let followersQ = db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId);
  let followingQ = db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", userId);
  if (demoIds.length > 0) {
    followersQ = followersQ.not("follower_id", "in", notIn);
    followingQ = followingQ.not("following_id", "in", notIn);
  }
  const [{ count: followers }, { count: following }] = await Promise.all([followersQ, followingQ]);

  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function isFollowing(targetUsername: string): Promise<boolean> {
  const session = await getSession();
  if (!session || session.username === targetUsername) return false;

  const db = getAdminClient();
  const [followerId, followingId] = await Promise.all([
    getUserIdByUsername(session.username),
    getUserIdByUsername(targetUsername),
  ]);
  if (!followerId || !followingId) return false;

  const { data } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function follow(targetUsername: string) {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (session.username === targetUsername) {
    return { error: "자기 자신은 팔로우할 수 없습니다." };
  }

  const db = getAdminClient();
  const [followerId, followingId] = await Promise.all([
    getUserIdByUsername(session.username),
    getUserIdByUsername(targetUsername),
  ]);
  if (!followerId || !followingId) return { error: "사용자를 찾을 수 없습니다." };

  const { error } = await db
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });

  if (error && !error.message.includes("duplicate")) {
    return { error: "팔로우에 실패했습니다." };
  }
  if (!error) {
    const { createNotification } = await import("@/lib/notifications");
    const { data: follower } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", followerId)
      .single();
    const label =
      (follower?.display_name as string | null) ||
      (follower?.username as string) ||
      "누군가";
    await createNotification({
      userId: followingId,
      type: "new_follower",
      title: `${label}님이 회원님을 팔로우합니다`,
      body: null,
      link: `/${follower?.username}`,
      actorId: followerId,
    });
  }
  revalidatePath(`/${targetUsername}`);
  return { success: true };
}

export async function unfollow(targetUsername: string) {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const db = getAdminClient();
  const [followerId, followingId] = await Promise.all([
    getUserIdByUsername(session.username),
    getUserIdByUsername(targetUsername),
  ]);
  if (!followerId || !followingId) return { error: "사용자를 찾을 수 없습니다." };

  const { error } = await db
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) return { error: "언팔로우에 실패했습니다." };
  revalidatePath(`/${targetUsername}`);
  return { success: true };
}

type PersonRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
};

export async function listFollowing(username: string) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return [] as PersonRow[];

  const { data } = await db
    .from("follows")
    .select(
      "following:users!follows_following_id_fkey(id, username, display_name, avatar_url, is_private)",
    )
    .eq("follower_id", userId);

  return data?.map((row) => row.following as unknown as PersonRow) ?? [];
}

export async function listFollowers(username: string) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return [] as PersonRow[];

  const { data } = await db
    .from("follows")
    .select(
      "follower:users!follows_follower_id_fkey(id, username, display_name, avatar_url, is_private)",
    )
    .eq("following_id", userId);

  return data?.map((row) => row.follower as unknown as PersonRow) ?? [];
}
