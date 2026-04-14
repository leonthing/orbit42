"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

async function getUserIdByUsername(username: string): Promise<string | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  return data?.id ?? null;
}

export async function getFollowStats(username: string) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return { followers: 0, following: 0 };

  const [{ count: followers }, { count: following }] = await Promise.all([
    db
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    db
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

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

export async function listFollowing(username: string) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return [] as { username: string; display_name: string | null; id: string }[];

  const { data } = await db
    .from("follows")
    .select("following:users!follows_following_id_fkey(id, username, display_name)")
    .eq("follower_id", userId);

  return (
    data?.map((row) => row.following as unknown as { id: string; username: string; display_name: string | null }) ?? []
  );
}

export async function listFollowers(username: string) {
  const db = getAdminClient();
  const userId = await getUserIdByUsername(username);
  if (!userId) return [] as { username: string; display_name: string | null; id: string }[];

  const { data } = await db
    .from("follows")
    .select("follower:users!follows_follower_id_fkey(id, username, display_name)")
    .eq("following_id", userId);

  return (
    data?.map((row) => row.follower as unknown as { id: string; username: string; display_name: string | null }) ?? []
  );
}
