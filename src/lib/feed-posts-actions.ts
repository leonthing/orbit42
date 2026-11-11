"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/feed-posts 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/feed-posts";

export async function createFeedPost(...args: Parameters<typeof impl.createFeedPost>) {
  return impl.createFeedPost(...args);
}

export async function deleteFeedPost(...args: Parameters<typeof impl.deleteFeedPost>) {
  return impl.deleteFeedPost(...args);
}

export async function shareEventToFeed(...args: Parameters<typeof impl.shareEventToFeed>) {
  return impl.shareEventToFeed(...args);
}
