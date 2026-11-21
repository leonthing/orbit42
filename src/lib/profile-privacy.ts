// 일반 서버 모듈 — 서버 액션 아님. 비공개 프로필(users.is_private) 판정은 모두 여기 하나로(11/21 PO).
//
// 약속(iOS 설정 문구와 같음): "프로필 비공개를 켜면 검색과 프로필 조회, 다른 사람의 오르빗에서 숨겨져요.
// 직접 공유한 예약 링크는 계속 동작해요." → 남·손님에게는 이름·사진·소개·링크·일정·글이 하나도 나가지 않고,
// 본인은 모든 화면 그대로. 예약 링크(/{u}/s/{slug})·게스트 예약(/b)은 허용.
//
// 이 함수를 쓰는 공개 표면(새 공개 화면을 만들면 여기와 인수인계 '비공개 표면 목록'에 더할 것):
//   /{u} 화면·메타·OG 이미지 · /{u}/calendar(남 보기) · /{u}/c · /{u}/followers · /{u}/following
//   · /feed · /{u}/blog · /{u}/blog/{id} · 블로그 서브도메인(목록·글·RSS·OG·첫 화면) · /api/og/post · sitemap
//   · 검색(lib/search.ts) · 예약 링크 호스트 카드의 '/{u}' 링크
import type { Metadata } from "next";
import { getAdminClient } from "@/lib/supabase";

type Owner = { username?: string | null; is_private?: boolean | null } | null | undefined;

/** 이 사람(owner)의 프로필을 viewer(로그인 아이디, 손님은 null)에게 가려야 하나 — 비공개이고 본인이 아니면 가린다. */
export function hiddenFrom(owner: Owner, viewer: string | null | undefined): boolean {
  return !!owner?.is_private && owner.username !== (viewer ?? undefined);
}

/** 아이디로 비공개 여부만 읽는다(없는 사람은 false — 없는 사람 처리는 각 화면의 notFound 몫). */
export async function isPrivateUsername(username: string): Promise<boolean> {
  const { data } = await getAdminClient().from("users").select("is_private").eq("username", username).maybeSingle();
  return Boolean((data as { is_private?: boolean | null } | null)?.is_private);
}

/** 아이디 목록 중 비공개인 아이디 집합(목록 화면·sitemap 용). */
export async function privateUsernames(usernames: string[]): Promise<Set<string>> {
  const list = Array.from(new Set(usernames.filter(Boolean)));
  if (list.length === 0) return new Set();
  const { data } = await getAdminClient().from("users").select("username, is_private").in("username", list).eq("is_private", true);
  return new Set((data ?? []).map((r) => r.username as string));
}

/** 사용자 id 목록 중 비공개인 id 집합(피드처럼 id 로 모으는 곳). */
export async function privateUserIds(ids: string[]): Promise<Set<string>> {
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return new Set();
  const { data } = await getAdminClient().from("users").select("id").in("id", list).eq("is_private", true);
  return new Set((data ?? []).map((r) => r.id as string));
}

/** 가린 화면의 메타데이터 — 이름·소개 없이, 검색엔진에 올리지 않는다. */
export const PRIVATE_PROFILE_METADATA: Metadata = {
  title: "비공개 프로필",
  description: "비공개 프로필이에요.",
  robots: { index: false, follow: false },
  openGraph: { title: "비공개 프로필 · Orbit42", siteName: "Orbit42", locale: "ko_KR" },
  twitter: { card: "summary", title: "비공개 프로필 · Orbit42" },
};

/** 아이디만 아는 화면(블로그·OG·RSS)용: viewer 가 본인이 아니고 그 사람이 비공개면 true. */
export async function hiddenUsername(username: string, viewer: string | null | undefined): Promise<boolean> {
  if (viewer && viewer === username) return false;
  return isPrivateUsername(username);
}
