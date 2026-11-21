/**
 * 비공개 프로필(11/21 PO) — 공통 판정 하나(lib/profile-privacy)와, 공개 표면이 모두 그 판정을 쓰는지.
 * 실제 응답(HTML 에 이름·소개 0건)은 임시 계정 실측으로 확인(업무기록), 여기서는 빠뜨림을 막는다.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("hiddenFrom: 비공개이고 본인이 아니면 가린다", async () => {
  const { hiddenFrom } = await import("../src/lib/profile-privacy");
  const priv = { username: "a", is_private: true };
  assert.equal(hiddenFrom(priv, null), true, "손님");
  assert.equal(hiddenFrom(priv, "b"), true, "남");
  assert.equal(hiddenFrom(priv, "a"), false, "본인");
  assert.equal(hiddenFrom({ username: "a", is_private: false }, null), false);
  assert.equal(hiddenFrom({ username: "a", is_private: null }, "b"), false);
  assert.equal(hiddenFrom(null, "b"), false);
});

// 표면 목록 — 새 공개 화면을 만들면 여기에도 더한다(인수인계 '비공개 표면 목록'과 같은 줄)
const SURFACES: Array<[string, RegExp]> = [
  ["src/app/[username]/page.tsx", /hiddenFrom\(profile[\s\S]*PRIVATE_PROFILE_METADATA[\s\S]*<PrivateProfileScreen \/>/],
  ["src/app/[username]/opengraph-image.tsx", /profile\?\.is_private/],
  ["src/app/[username]/calendar/page.tsx", /hiddenFrom\(profile, session\?\.username\)\) return <PrivateProfileScreen/],
  ["src/app/[username]/c/page.tsx", /PRIVATE_PROFILE_METADATA[\s\S]*<PrivateProfileScreen/],
  ["src/app/[username]/followers/page.tsx", /PRIVATE_PROFILE_METADATA[\s\S]*<PrivateProfileScreen/],
  ["src/app/[username]/following/page.tsx", /PRIVATE_PROFILE_METADATA[\s\S]*<PrivateProfileScreen/],
  ["src/app/feed/page.tsx", /followingAll\.filter\(\(u\) => !hiddenFrom\(u, session\.username\)\)/],
  ["src/app/[username]/blog/page.tsx", /hiddenFrom\(profile, session\?\.username\)\) return <PrivateProfileScreen/],
  ["src/app/[username]/blog/[postId]/page.tsx", /hiddenUsername[\s\S]*PRIVATE_PROFILE_METADATA[\s\S]*hiddenUsername[\s\S]*<PrivateProfileScreen/],
  ["src/app/blog-public/actions.ts", /is_private\.is\.null,is_private\.eq\.false[\s\S]*is_private\.is\.null,is_private\.eq\.false/],
  ["src/app/blog-public/page.tsx", /is_private\.is\.null,is_private\.eq\.false/],
  ["src/lib/posts.ts", /if \(!u \|\| u\.is_private\) return null;/],
  ["src/app/sitemap.ts", /select\("username, updated_at"\)\.or\("is_private\.is\.null,is_private\.eq\.false"\)[\s\S]*host\.is_private[\s\S]*user\.is_private/],
  ["src/app/[username]/s/[slug]/page.tsx", /hostPrivate = !isOwner && \(await isPrivateUsername/],
  ["src/lib/search.ts", /!u\.is_private \|\| u\.username === viewer/],
  // v1·웹 앱 글(1.10.0): 상세·좋아요·신고(visibleRow), 목록(listPosts·listPostsForWeb), 사이트맵·RSS(listPublicAppPostsForFeeds)
  ["src/lib/posts.ts", /if \(await isPrivateUserId\(r\.user_id\)\) return null;[\s\S]*authorId !== me && \(await isPrivateUserId\(authorId\)\)\) return \{ posts: \[\], nextBefore: null \}[\s\S]*!own && \(await isPrivateUserId\(authorId\)\)\) return \[\];[\s\S]*filter\(\(p\) => !\(p\.user as unknown as \{ is_private/],
];
for (const [file, re] of SURFACES) {
  test(`비공개 표면: ${file}`, () => {
    assert.match(readFileSync(file, "utf8"), re);
  });
}

test("getProfile 이 is_private 를 읽는다(공개 화면 판정의 바탕)", () => {
  const src = readFileSync("src/lib/auth.ts", "utf8");
  const sel = src.slice(src.indexOf("export async function getProfile"), src.indexOf("export async function getProfile") + 600);
  assert.match(sel, /link_theme, is_private/);
});
