// 일반 서버 모듈 — 서버 액션 아님. 글·사진(1.10.0) 앱 API 의 본체 (/api/v1/posts/*).
// 설계: 업무기록/설계_1.10.0_블로그사진.md. 글은 blog_posts(origin 'app'), 사진은 post_photos + 비공개 버킷.
// 시험 기간: 보는 사람·쓰는 사람 모두 허용 목록(posts-access)만. 웹 공개 경로에는 'app' 글이 나가지 않는다.
import { randomBytes, randomUUID } from "crypto";
import { getAdminClient } from "@/lib/supabase";
import { rateLimitDb } from "@/lib/rate-limit";
import { postsOpenFor, postsPublic, postsVisibleTo } from "@/lib/posts-access";
import {
  POST_PHOTO_BUCKET,
  POST_PHOTO_MAX_BYTES,
  reencodePhoto,
  removePhotoFiles,
  removePhotoFolder,
  signPhotoUrls,
} from "@/lib/post-photos";

const db = () => getAdminClient();
const DAY = 24 * 3600_000;
export const POST_MAX_PHOTOS = 10;
export const POST_TITLE_MAX = 100;
export const POST_BODY_MAX = 5000;
const LIST_LIMIT = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE = "https://orbit42.org";

export type PostErr = { error: string; code?: "closed" | "not_found" | "limit" | "invalid" | "forbidden" };
const closed = (): PostErr => ({ error: "아직 쓸 수 없는 기능이에요.", code: "closed" });
const notFound = (): PostErr => ({ error: "글을 찾을 수 없어요.", code: "not_found" });

type PostRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  published: boolean;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  edited_at: string | null;
  slug: string;
};
type PhotoRow = { id: string; post_id: string; position: number; storage_key: string; width: number; height: number; caption: string | null };
type Author = { id: string; username: string; displayName: string | null; avatarUrl: string | null; pinnedPostId: string | null };

export type ApiPhoto = { id: string; url: string | null; width: number; height: number; position: number; caption: string | null };
export type ApiPost = {
  id: string;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
  title: string;
  body: string;
  visibility: "public" | "private";
  /** 운영자가 숨김 — 작성자에게만 보인다 */
  hidden: boolean;
  photos: ApiPhoto[];
  photoCount: number;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
  /** 처음 공개한 시각(한 번도 공개 안 한 임시 저장 글은 null) */
  publishedAt: string | null;
  /** "수정됨" — 처음 공개 10분 뒤 제목·본문·사진·설명을 바꾼 마지막 시각 */
  editedAt: string | null;
  /** 작성자의 링크 페이지 맨 위 고정 글인지 */
  pinned: boolean;
  slug: string;
  /** 공유용 주소 */
  url: string;
  /** 지금 남이 이 주소를 열 수 있는지(공개 스위치 켜짐 + 공개 + 숨김 아님) — 꺼져 있으면 앱이 "공개 전" 안내 */
  shareable: boolean;
  /** 상세에서만: 예약하기 버튼 주소(공개 예약 링크가 하나면 그 링크, 여럿이면 링크 페이지, 없으면 null) */
  bookingUrl?: string | null;
};

const POST_COLS = "id, user_id, title, content, published, hidden_at, created_at, updated_at, published_at, edited_at, slug";
const PHOTO_COLS = "id, post_id, position, storage_key, width, height, caption";
export const POST_CAPTION_MAX = 200;
/** 처음 공개하고 이만큼 지난 뒤 고치면 "수정됨" */
const EDIT_GRACE_MS = 10 * 60_000;
const likeTarget = (postId: string) => `app:${postId}`;

function cleanText(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  // 제어 문자(줄바꿈·탭 제외) 제거, 앞뒤 공백 정리
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

async function authorsOf(ids: string[]): Promise<Map<string, Author>> {
  const out = new Map<string, Author>();
  if (ids.length === 0) return out;
  const { data } = await db().from("users").select("id, username, display_name, avatar_url, pinned_post_id").in("id", ids);
  for (const u of data ?? [])
    out.set(u.id as string, {
      id: u.id as string,
      username: u.username as string,
      displayName: (u.display_name as string | null) ?? null,
      avatarUrl: (u.avatar_url as string | null) ?? null,
      pinnedPostId: (u.pinned_post_id as string | null) ?? null,
    });
  return out;
}

async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const { data } = await db()
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** 행 → 응답. photosMode 'all' 은 모든 사진, 'cover' 는 첫 장만 서명한다(목록). */
async function shape(me: string | null, rows: PostRow[], photosMode: "all" | "cover"): Promise<ApiPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [authors, photosRes, likesRes, mineRes] = await Promise.all([
    authorsOf(Array.from(new Set(rows.map((r) => r.user_id)))),
    db().from("post_photos").select(PHOTO_COLS).in("post_id", ids).order("position"),
    db().from("reactions").select("target_id").eq("target_type", "post").in("target_id", ids.map(likeTarget)),
    me
      ? db().from("reactions").select("target_id").eq("target_type", "post").eq("user_id", me).in("target_id", ids.map(likeTarget))
      : Promise.resolve({ data: [] as { target_id: string }[] }),
  ]);
  const photos = (photosRes.data ?? []) as PhotoRow[];
  const byPost = new Map<string, PhotoRow[]>();
  for (const p of photos) byPost.set(p.post_id, [...(byPost.get(p.post_id) ?? []), p]);
  const toSign = photosMode === "all" ? photos : rows.map((r) => byPost.get(r.id)?.[0]).filter((p): p is PhotoRow => !!p);
  const urls = await signPhotoUrls(toSign.map((p) => p.storage_key));
  const likeCount = new Map<string, number>();
  for (const l of likesRes.data ?? []) likeCount.set(l.target_id as string, (likeCount.get(l.target_id as string) ?? 0) + 1);
  const liked = new Set((mineRes.data ?? []).map((l) => l.target_id as string));
  const open = postsPublic();
  return rows.map((r) => {
    const a = authors.get(r.user_id);
    const list = byPost.get(r.id) ?? [];
    const shown = photosMode === "all" ? list : list.slice(0, 1);
    return {
      id: r.id,
      author: { username: a?.username ?? "", displayName: a?.displayName ?? null, avatarUrl: a?.avatarUrl ?? null },
      title: r.title ?? "",
      body: r.content ?? "",
      visibility: r.published ? "public" : "private",
      hidden: !!r.hidden_at,
      photos: shown.map((p) => ({ id: p.id, url: urls.get(p.storage_key) ?? null, width: p.width, height: p.height, position: p.position, caption: p.caption ?? null })),
      photoCount: list.length,
      likeCount: likeCount.get(likeTarget(r.id)) ?? 0,
      liked: liked.has(likeTarget(r.id)),
      mine: r.user_id === me,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      publishedAt: r.published_at,
      editedAt: r.edited_at,
      pinned: !!a?.pinnedPostId && a.pinnedPostId === r.id,
      slug: r.slug,
      url: `${SITE}/${a?.username ?? ""}/blog/${encodeURIComponent(r.slug)}`,
      shareable: open && r.published && !r.hidden_at,
    };
  });
}

/** 내가 볼 수 있는 글 한 개(행) — 남의 글은 공개·숨김 아님·차단 아님일 때만 */
async function visibleRow(me: string | null, id: string): Promise<PostRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await db().from("blog_posts").select(POST_COLS).eq("id", id).eq("origin", "app").maybeSingle();
  const r = data as PostRow | null;
  if (!r) return null;
  if (me && r.user_id === me) return r;
  if (!r.published || r.hidden_at) return null;
  if (me && (await blockedEitherWay(me, r.user_id))) return null;
  return r;
}

async function ownRow(me: string, id: string): Promise<PostRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await db().from("blog_posts").select(POST_COLS).eq("id", id).eq("origin", "app").eq("user_id", me).maybeSingle();
  return (data as PostRow | null) ?? null;
}

/** 처음 공개 10분 뒤의 내용 변경이면 edited_at 을 찍는다(updated_at 과 따로) */
function editedPatch(r: { published_at: string | null }): { edited_at?: string } {
  if (!r.published_at) return {};
  return Date.now() - Date.parse(r.published_at) > EDIT_GRACE_MS ? { edited_at: new Date().toISOString() } : {};
}

async function touch(r: PostRow, edited: boolean) {
  await db().from("blog_posts").update({ updated_at: new Date().toISOString(), ...(edited ? editedPatch(r) : {}) }).eq("id", r.id);
}

async function bookingUrlFor(userId: string, username: string): Promise<string | null> {
  const { listPublicSlotsByUsername } = await import("@/lib/slots");
  const slots = await listPublicSlotsByUsername(username).catch(() => []);
  void userId;
  if (slots.length === 0) return null;
  if (slots.length === 1) return `${SITE}/${username}/s/${encodeURIComponent(slots[0].slug)}`;
  return `${SITE}/${username}`;
}

/** 고정 글을 맨 앞으로(목록 범위 밖의 옛 글이어도). 공개·숨김 아님일 때만 — 본인 목록도 같은 규칙 */
async function pinFirst(authorId: string, rows: PostRow[], limit: number) {
  const { data: au } = await db().from("users").select("pinned_post_id").eq("id", authorId).maybeSingle();
  const pinId = (au?.pinned_post_id as string | null) ?? null;
  if (!pinId) return;
  let pin = rows.find((r) => r.id === pinId) ?? null;
  if (!pin) {
    const { data: pr } = await db().from("blog_posts").select(POST_COLS).eq("id", pinId).eq("origin", "app").eq("user_id", authorId).maybeSingle();
    pin = (pr as PostRow | null) ?? null;
  }
  if (!pin || !pin.published || pin.hidden_at) return;
  const rest = rows.filter((r) => r.id !== pinId);
  rows.splice(0, rows.length, pin, ...rest.slice(0, Math.max(limit - 1, 0)));
}

// ── 목록·상세 ──

/** GET 목록: username 이 없으면 내 글(나만 보기·숨김 포함), 있으면 그 사람의 공개 글 */
export async function listPosts(me: string, opts: { username?: string | null; before?: string | null }) {
  if (!postsOpenFor(me)) return closed();
  let authorId = me;
  if (opts.username) {
    const { data: u } = await db().from("users").select("id").eq("username", opts.username).maybeSingle();
    if (!u) return { error: "사용자를 찾을 수 없어요.", code: "not_found" } as PostErr;
    authorId = u.id as string;
    if (authorId !== me && (await blockedEitherWay(me, authorId))) return { posts: [], nextBefore: null };
  }
  let q = db()
    .from("blog_posts")
    .select(POST_COLS)
    .eq("origin", "app")
    .eq("user_id", authorId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT + 1);
  if (authorId !== me) q = q.eq("published", true).is("hidden_at", null);
  if (opts.before && !Number.isNaN(Date.parse(opts.before))) q = q.lt("created_at", new Date(opts.before).toISOString());
  const { data, error } = await q;
  if (error) return { error: "글을 불러오지 못했어요." } as PostErr;
  const rows = (data ?? []) as PostRow[];
  const page = rows.slice(0, LIST_LIMIT);
  const cursor = rows.length > LIST_LIMIT ? page[page.length - 1].created_at : null;
  // 첫 쪽만 고정 글을 맨 앞에(다음 쪽 기준 시각은 고정 전 목록으로).
  // 다음 쪽에서는 고정 글을 빼서 두 번 나오지 않게
  if (!opts.before) await pinFirst(authorId, page, LIST_LIMIT + 1);
  else {
    const { data: au } = await db().from("users").select("pinned_post_id").eq("id", authorId).maybeSingle();
    const i = page.findIndex((r) => r.id === au?.pinned_post_id);
    if (i >= 0) page.splice(i, 1);
  }
  const posts = await shape(me, page, "cover");
  return { posts, nextBefore: cursor };
}

export async function getPost(me: string, id: string) {
  if (!postsOpenFor(me)) return closed();
  const r = await visibleRow(me, id);
  if (!r) return notFound();
  const [post] = await shape(me, [r], "all");
  const author = await authorsOf([r.user_id]);
  post.bookingUrl = await bookingUrlFor(r.user_id, author.get(r.user_id)?.username ?? "");
  return { post };
}

// ── 웹 화면용 (1.10.0) — 보는 사람은 비로그인(null)일 수 있다 ──

/** 웹 상세: 슬러그로 앱 글 하나. 볼 수 없으면 null(→ 404) */
export async function getPostForWeb(viewerId: string | null, username: string, slug: string): Promise<ApiPost | null> {
  const { data: u } = await db().from("users").select("id, username").eq("username", username).maybeSingle();
  if (!u) return null;
  const own = viewerId === u.id;
  if (!own && !postsVisibleTo(viewerId)) return null;
  if (own && !postsOpenFor(viewerId)) return null;
  const { data } = await db().from("blog_posts").select("id").eq("origin", "app").eq("user_id", u.id).eq("slug", slug).maybeSingle();
  if (!data) return null;
  const r = await visibleRow(viewerId, data.id as string);
  if (!r) return null;
  const [post] = await shape(viewerId, [r], "all");
  post.bookingUrl = own ? null : await bookingUrlFor(r.user_id, u.username as string);
  return post;
}

/** 웹 목록(링크 페이지 칸·글 목록): 그 사람의 공개 앱 글. 본인이면 나만 보기·숨김 포함. 볼 수 없으면 [] */
export async function listPostsForWeb(viewerId: string | null, authorId: string, limit = 30): Promise<ApiPost[]> {
  const own = viewerId === authorId;
  if (own ? !postsOpenFor(viewerId) : !postsVisibleTo(viewerId)) return [];
  if (!own && viewerId && (await blockedEitherWay(viewerId, authorId))) return [];
  let q = db()
    .from("blog_posts")
    .select(POST_COLS)
    .eq("origin", "app")
    .eq("user_id", authorId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 60));
  if (!own) q = q.eq("published", true).is("hidden_at", null);
  const { data } = await q;
  const rows = (data ?? []) as unknown as PostRow[];
  await pinFirst(authorId, rows, limit);
  return shape(viewerId, rows, "cover");
}

/** 공개 스위치가 켜졌을 때만: 사이트맵·RSS 용 공개 앱 글(사진 없이) */
export async function listPublicAppPostsForFeeds(authorId?: string, limit = 5000) {
  const { postsPublic } = await import("@/lib/posts-access");
  if (!postsPublic()) return [];
  let q = db()
    .from("blog_posts")
    .select("id, slug, title, content, published_at, created_at, user:users!blog_posts_user_id_fkey(username)")
    .eq("origin", "app")
    .eq("published", true)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (authorId) q = q.eq("user_id", authorId);
  const { data } = await q;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    title: (p.title as string) || "",
    body: (p.content as string) || "",
    publishedAt: ((p.published_at as string | null) ?? (p.created_at as string)) as string,
    username: ((p.user as unknown as { username: string } | null)?.username ?? "") as string,
  }));
}

/** OG 이미지용: 공개 스위치가 켜졌고 공개 글일 때 대표(첫) 사진 원본(JPEG, 없으면 null)·제목·작성자 — 아니면 null */
export async function ogDataForPost(
  username: string,
  slug: string,
): Promise<{ photo: Buffer | null; title: string; body: string; authorName: string } | null> {
  const { postsPublic } = await import("@/lib/posts-access");
  if (!postsPublic()) return null;
  const { data: u } = await db().from("users").select("id, username, display_name").eq("username", username).maybeSingle();
  if (!u) return null;
  const { data: p } = await db()
    .from("blog_posts")
    .select("id, title, content")
    .eq("origin", "app")
    .eq("user_id", u.id)
    .eq("slug", slug)
    .eq("published", true)
    .is("hidden_at", null)
    .maybeSingle();
  if (!p) return null;
  const { data: ph } = await db().from("post_photos").select("storage_key").eq("post_id", p.id).order("position").limit(1);
  const key = ph?.[0]?.storage_key as string | undefined;
  let photo: Buffer | null = null;
  if (key) {
    const dl = await db().storage.from(POST_PHOTO_BUCKET).download(key);
    if (!dl.error && dl.data) photo = Buffer.from(await dl.data.arrayBuffer());
  }
  return {
    photo,
    title: (p.title as string) || "",
    body: (p.content as string) || "",
    authorName: (u.display_name as string | null) || (u.username as string),
  };
}

// ── 쓰기 ──

/**
 * 새 글. 사진은 글을 만든 뒤 한 장씩 올린다 — 앱은 '나만 보기'로 만들고 사진을 다 올린 뒤 공개로 바꾼다.
 * 그래서 빈 글(제목·본문·사진 모두 없음)은 '나만 보기'로만 만들 수 있고, 공개로 바꿀 때 내용이 있어야 한다.
 */
export async function createPost(me: string, input: { title?: unknown; body?: unknown; public?: unknown }) {
  if (!postsOpenFor(me)) return closed();
  const title = cleanText(input.title, POST_TITLE_MAX) ?? "";
  const body = cleanText(input.body, POST_BODY_MAX) ?? "";
  const isPublic = input.public === true;
  if (isPublic && !title && !body) return { error: "사진을 올린 뒤 공개로 바꿔 주세요.", code: "invalid" } as PostErr;
  const limit = await rateLimitDb(`post-create:${me}`, 20, DAY);
  if (!limit.ok) return { error: "글은 하루 20개까지 쓸 수 있어요.", code: "limit" } as PostErr;
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("blog_posts")
    .insert({
      user_id: me,
      origin: "app",
      slug: `p-${randomBytes(6).toString("hex")}`,
      title,
      content: body,
      published: isPublic,
      published_at: isPublic ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select(POST_COLS)
    .single();
  if (error || !data) {
    console.error("[posts] create", error?.message);
    return { error: "글을 저장하지 못했어요." } as PostErr;
  }
  if (isPublic) await notifyFollowersOfNewPost(me, (data as PostRow).id);
  const [post] = await shape(me, [data as PostRow], "all");
  return { post };
}

export async function updatePost(me: string, id: string, input: { title?: unknown; body?: unknown; public?: unknown }) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r) return notFound();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = cleanText(input.title, POST_TITLE_MAX) ?? "";
  if (input.body !== undefined) patch.content = cleanText(input.body, POST_BODY_MAX) ?? "";
  if (input.public !== undefined) {
    if (typeof input.public !== "boolean") return { error: "잘못된 요청이에요.", code: "invalid" } as PostErr;
    patch.published = input.public;
  }
  // 처음 공개하는 때만 published_at 을 찍고 팔로워 알림을 보낸다(나만 보기 ↔ 공개를 오가도 다시 안 보냄)
  let firstPublish = false;
  if (input.public === true && !r.published) {
    const { data: pa } = await db().from("blog_posts").select("published_at").eq("id", id).single();
    if (!pa?.published_at) {
      patch.published_at = new Date().toISOString();
      firstPublish = true;
    }
  }
  const nextTitle = (patch.title as string | undefined) ?? r.title ?? "";
  const nextBody = (patch.content as string | undefined) ?? r.content ?? "";
  const nextPublic = (patch.published as boolean | undefined) ?? r.published;
  if (nextPublic && !nextTitle && !nextBody) {
    const { count } = await db().from("post_photos").select("id", { count: "exact", head: true }).eq("post_id", id);
    if (!count) return { error: "제목·본문·사진 중 하나는 있어야 공개할 수 있어요.", code: "invalid" } as PostErr;
  }
  patch.updated_at = new Date().toISOString();
  if (nextTitle !== (r.title ?? "") || nextBody !== (r.content ?? "")) Object.assign(patch, editedPatch(r));
  const { data, error } = await db().from("blog_posts").update(patch).eq("id", id).eq("user_id", me).select(POST_COLS).single();
  if (error || !data) return { error: "글을 저장하지 못했어요." } as PostErr;
  if (firstPublish) await notifyFollowersOfNewPost(me, id);
  const [post] = await shape(me, [data as PostRow], "all");
  return { post };
}

/**
 * 팔로우한 사람의 새 공개 글 알림(1.10.0) — 공개 스위치(POSTS_PUBLIC)가 켜졌을 때만.
 * 본문 없이 "○○님이 새 글을 올렸어요". 차단 관계는 뺀다. 실패해도 글 저장은 그대로.
 */
async function notifyFollowersOfNewPost(authorId: string, postId: string) {
  try {
    const { postsPublic } = await import("@/lib/posts-access");
    if (!postsPublic()) return;
    const [{ data: author }, { data: post }, { data: fols }, { data: blocks }] = await Promise.all([
      db().from("users").select("username, display_name").eq("id", authorId).single(),
      db().from("blog_posts").select("slug").eq("id", postId).single(),
      db().from("follows").select("follower_id").eq("following_id", authorId).limit(2000),
      db().from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${authorId},blocked_id.eq.${authorId}`),
    ]);
    if (!author || !post) return;
    const blocked = new Set((blocks ?? []).map((b) => (b.blocker_id === authorId ? b.blocked_id : b.blocker_id) as string));
    const name = (author.display_name as string | null) || (author.username as string);
    const link = `/${author.username}/blog/${encodeURIComponent(post.slug as string)}`;
    const { createNotification } = await import("@/lib/notifications");
    for (const f of fols ?? []) {
      const uid = f.follower_id as string;
      if (uid === authorId || blocked.has(uid)) continue;
      await createNotification({ userId: uid, type: "new_post", title: `${name}님이 새 글을 올렸어요`, body: null, link, actorId: authorId });
    }
  } catch (e) {
    console.error("[posts] notify followers", e);
  }
}

/** 글 삭제: 사진 파일(폴더 통째) → 행. 파일을 못 지우면 행도 남겨 다시 지울 수 있게 한다. */
export async function deletePost(me: string, id: string) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r) return notFound();
  try {
    await removePhotoFolder(`${me}/${id}`);
  } catch (e) {
    console.error("[posts] delete folder", e);
    return { error: "사진을 지우지 못했어요. 잠시 후 다시 시도해 주세요." } as PostErr;
  }
  await db().from("reactions").delete().eq("target_type", "post").eq("target_id", likeTarget(id));
  const { error } = await db().from("blog_posts").delete().eq("id", id).eq("user_id", me);
  if (error) return { error: "글을 지우지 못했어요." } as PostErr;
  return { ok: true as const };
}

// ── 사진 ──

export async function addPhoto(me: string, id: string, file: Blob | null) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r) return notFound();
  if (!file || typeof file.arrayBuffer !== "function") return { error: "사진을 골라 주세요.", code: "invalid" } as PostErr;
  if (file.size === 0) return { error: "빈 파일이에요.", code: "invalid" } as PostErr;
  if (file.size > POST_PHOTO_MAX_BYTES) return { error: "사진이 너무 커요(한 장 4MB까지).", code: "invalid" } as PostErr;
  const { data: existing } = await db().from("post_photos").select("position").eq("post_id", id);
  const used = new Set((existing ?? []).map((p) => p.position as number));
  if (used.size >= POST_MAX_PHOTOS) return { error: "사진은 글 하나에 10장까지예요.", code: "limit" } as PostErr;
  const limit = await rateLimitDb(`post-photo:${me}`, 200, DAY);
  if (!limit.ok) return { error: "사진은 하루 200장까지 올릴 수 있어요.", code: "limit" } as PostErr;

  let enc;
  try {
    enc = await reencodePhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "사진을 읽지 못했어요. JPG·PNG 사진으로 올려 주세요.", code: "invalid" } as PostErr;
  }
  const photoId = randomUUID();
  const key = `${me}/${id}/${photoId}.jpg`;
  const up = await db().storage.from(POST_PHOTO_BUCKET).upload(key, enc.data, { contentType: "image/jpeg", upsert: false });
  if (up.error) {
    console.error("[posts] upload", up.error.message);
    return { error: "사진을 올리지 못했어요. 다시 시도해 주세요." } as PostErr;
  }
  // 빈 자리 중 가장 앞(동시에 올리면 유일 제약에 걸릴 수 있어 몇 번 다시 시도)
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: now } = await db().from("post_photos").select("position").eq("post_id", id);
    const taken = new Set((now ?? []).map((p) => p.position as number));
    let pos = 0;
    while (taken.has(pos)) pos++;
    if (pos >= POST_MAX_PHOTOS) break;
    const ins = await db()
      .from("post_photos")
      .insert({ id: photoId, post_id: id, user_id: me, position: pos, storage_key: key, width: enc.width, height: enc.height, bytes: enc.bytes })
      .select(PHOTO_COLS)
      .single();
    if (!ins.error && ins.data) {
      await touch(r, true);
      const urls = await signPhotoUrls([key]);
      const p = ins.data as PhotoRow;
      return { photo: { id: p.id, url: urls.get(key) ?? null, width: p.width, height: p.height, position: p.position, caption: p.caption ?? null } as ApiPhoto };
    }
    if (ins.error && ins.error.code !== "23505") {
      console.error("[posts] photo row", ins.error.message);
      break;
    }
  }
  await removePhotoFiles([key]);
  return { error: "사진을 저장하지 못했어요. 다시 시도해 주세요." } as PostErr;
}

/** 사진 하나 빼기 — 행과 파일을 바로 지우고, 뒤 사진들을 앞으로 당긴다 */
export async function removePhoto(me: string, id: string, photoId: string) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r || !UUID.test(photoId)) return notFound();
  const { data } = await db().from("post_photos").select("id, storage_key").eq("id", photoId).eq("post_id", id).maybeSingle();
  if (!data) return { error: "사진을 찾을 수 없어요.", code: "not_found" } as PostErr;
  if (!(await removePhotoFiles([data.storage_key as string]))) return { error: "사진을 지우지 못했어요. 다시 시도해 주세요." } as PostErr;
  await db().from("post_photos").delete().eq("id", photoId);
  const { data: rest } = await db().from("post_photos").select("id").eq("post_id", id).order("position");
  await applyOrder(id, (rest ?? []).map((p) => p.id as string));
  // 공개 글의 마지막 사진을 빼서 빈 글이 되면 나만 보기로 돌린다
  if (r.published && !(r.title ?? "") && !(r.content ?? "") && (rest ?? []).length === 0) {
    await db().from("blog_posts").update({ published: false }).eq("id", id);
  }
  await touch(r, true);
  return { ok: true as const };
}

/** 순서를 한 트랜잭션으로 바꾼다(reorder_post_photos — 유일 제약 지연 검사) */
async function applyOrder(postId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await db().rpc("reorder_post_photos", { p_post: postId, p_ids: ids });
  if (error) console.error("[posts] reorder", error.message);
  return !error;
}

export async function reorderPhotos(me: string, id: string, order: unknown) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r) return notFound();
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) return { error: "잘못된 요청이에요.", code: "invalid" } as PostErr;
  const { data } = await db().from("post_photos").select("id").eq("post_id", id).order("position");
  const have = new Set((data ?? []).map((p) => p.id as string));
  const ids = order as string[];
  const same = (data ?? []).every((p, i) => p.id === ids[i]);
  if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((x) => !have.has(x)))
    return { error: "사진 목록이 맞지 않아요. 새로 고친 뒤 다시 시도해 주세요.", code: "invalid" } as PostErr;
  if (!same) {
    if (!(await applyOrder(id, ids))) return { error: "순서를 바꾸지 못했어요." } as PostErr;
    await touch(r, true);
  }
  const [post] = await shape(me, [(await ownRow(me, id))!], "all");
  return { post };
}

/** 사진 설명(캡션) — 빈 글자면 지운다 */
export async function setPhotoCaption(me: string, id: string, photoId: string, caption: unknown) {
  if (!postsOpenFor(me)) return closed();
  const r = await ownRow(me, id);
  if (!r || !UUID.test(photoId)) return notFound();
  if (caption !== null && typeof caption !== "string") return { error: "잘못된 요청이에요.", code: "invalid" } as PostErr;
  const text = (cleanText(caption, POST_CAPTION_MAX) ?? "").replace(/\s*\n\s*/g, " ") || null;
  const { data: cur } = await db().from("post_photos").select("caption").eq("id", photoId).eq("post_id", id).maybeSingle();
  if (!cur) return { error: "사진을 찾을 수 없어요.", code: "not_found" } as PostErr;
  if ((cur.caption ?? null) !== text) {
    const { error } = await db().from("post_photos").update({ caption: text }).eq("id", photoId).eq("post_id", id);
    if (error) return { error: "설명을 저장하지 못했어요." } as PostErr;
    await touch(r, true);
  }
  return { ok: true as const, caption: text };
}

/** 링크 페이지 맨 위 고정 글 1개 — 내 앱 글만(남의 글·없는 글은 거절). null 이면 풀기 */
export async function setPinnedPost(me: string, postId: unknown) {
  if (!postsOpenFor(me)) return closed();
  if (postId !== null && typeof postId !== "string") return { error: "잘못된 요청이에요.", code: "invalid" } as PostErr;
  if (postId) {
    const r = await ownRow(me, postId);
    if (!r) return notFound();
    if (!r.published || r.hidden_at) return { error: "공개된 글만 고정할 수 있어요.", code: "invalid" } as PostErr;
  }
  const { error } = await db().from("users").update({ pinned_post_id: postId || null }).eq("id", me);
  if (error) return { error: "고정하지 못했어요." } as PostErr;
  return { ok: true as const, pinnedPostId: (postId as string | null) || null };
}

// ── ❤️·신고 ──

export async function setLike(me: string, id: string, on: boolean) {
  if (!postsOpenFor(me)) return closed();
  const r = await visibleRow(me, id);
  if (!r) return notFound();
  if (on) {
    await db()
      .from("reactions")
      .upsert({ user_id: me, target_type: "post", target_id: likeTarget(id), emoji: "❤️" }, { onConflict: "user_id,target_type,target_id,emoji", ignoreDuplicates: true });
  } else {
    await db().from("reactions").delete().eq("user_id", me).eq("target_type", "post").eq("target_id", likeTarget(id));
  }
  const { count } = await db().from("reactions").select("id", { count: "exact", head: true }).eq("target_type", "post").eq("target_id", likeTarget(id));
  return { liked: on, likeCount: count ?? 0 };
}

export async function reportPost(me: string, id: string, reason: unknown) {
  if (!postsOpenFor(me)) return closed();
  const r = await visibleRow(me, id);
  if (!r) return notFound();
  if (r.user_id === me) return { error: "내 글은 신고할 수 없어요.", code: "invalid" } as PostErr;
  const limit = await rateLimitDb(`post-report:${me}`, 20, DAY);
  if (!limit.ok) return { error: "신고는 하루 20건까지 할 수 있어요.", code: "limit" } as PostErr;
  const { count } = await db().from("post_photos").select("id", { count: "exact", head: true }).eq("post_id", id);
  // 사진 파일은 신고 기록에 남기지 않는다(설계 2-5) — 운영자는 처리 전 원래 글을 본다
  const { error } = await db().from("message_reports").insert({
    kind: "post",
    post_id: id,
    reporter_role: "member",
    reporter_id: me,
    reason: (cleanText(reason, 500) ?? "") || null,
    body_snapshot: JSON.stringify({ reportedUserId: r.user_id, title: r.title ?? "", body: (r.content ?? "").slice(0, 2000), photoCount: count ?? 0 }),
  });
  if (error) {
    console.error("[posts] report", error.message);
    return { error: "신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요." } as PostErr;
  }
  try {
    const admins = (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (admins.length) {
      const { data: users } = await db().from("users").select("id").in("username", admins);
      const { createNotification } = await import("@/lib/notifications");
      for (const u of users ?? [])
        await createNotification({ userId: u.id as string, type: "booking_message_report", title: "글 신고가 들어왔어요", body: null, link: "/admin/reports" });
    }
  } catch (err) {
    console.error("[posts] report notify", err);
  }
  return { ok: true as const };
}

/** 운영자용: 신고된 글의 사진 서명 주소(처리 전 확인) */
export async function adminPostPhotos(postId: string): Promise<string[]> {
  const { data } = await db().from("post_photos").select("storage_key").eq("post_id", postId).order("position");
  const keys = (data ?? []).map((p) => p.storage_key as string);
  const urls = await signPhotoUrls(keys);
  return keys.map((k) => urls.get(k)).filter((u): u is string => !!u);
}

/** 정리(cron): 하루 넘은 빈 앱 글(제목·본문·사진 없음)과 그 폴더 — 업로드를 끝내지 못하고 떠난 글 */
export async function cleanupEmptyAppPosts(now = new Date()): Promise<number> {
  const { data } = await db()
    .from("blog_posts")
    .select("id, user_id")
    .eq("origin", "app")
    .eq("title", "")
    .eq("content", "")
    .lt("created_at", new Date(now.getTime() - DAY).toISOString())
    .limit(200);
  let n = 0;
  for (const p of data ?? []) {
    const { count } = await db().from("post_photos").select("id", { count: "exact", head: true }).eq("post_id", p.id);
    if (count) continue;
    try {
      await removePhotoFolder(`${p.user_id}/${p.id}`);
    } catch {
      continue;
    }
    await db().from("blog_posts").delete().eq("id", p.id);
    n++;
  }
  return n;
}
