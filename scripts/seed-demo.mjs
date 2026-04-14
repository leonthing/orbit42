/* eslint-disable no-console */
// Seed demo accounts + content for orbit42.
// Usage: node scripts/seed-demo.mjs
//
// Idempotent: deletes the test users by username first (cascades clear their
// posts/slots/follows/reactions), then re-inserts a fresh world.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- env ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.+)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = "demo1234";

const USERS = [
  {
    username: "mina",
    display_name: "민아",
    bio: "프로덕트 디자이너. 사이드 프로젝트랑 멘토링을 좋아해요.",
    interests: ["디자인", "프로덕트", "멘토링"],
  },
  {
    username: "junho",
    display_name: "준호",
    bio: "주중엔 백엔드 엔지니어, 주말엔 클라이밍.",
    interests: ["개발", "클라이밍", "커피"],
  },
  {
    username: "sora",
    display_name: "소라",
    bio: "마케터. 글 쓰는 걸 좋아해요. 매주 무료 커피챗을 엽니다.",
    interests: ["마케팅", "글쓰기", "독서"],
  },
  {
    username: "daeun",
    display_name: "다은",
    bio: "에세이 작가. 같이 쓰는 사람을 찾고 있어요.",
    interests: ["글쓰기", "에세이", "출판"],
  },
  {
    username: "theo",
    display_name: "Theo",
    bio: "프리랜스 셰프. 작은 워크숍을 열고 있어요.",
    interests: ["요리", "와인", "팝업"],
  },
];

const POSTS = {
  mina: [
    {
      title: "1주일에 한 번, 1:1 멘토링을 하는 이유",
      excerpt: "남에게 설명할 때 내 생각이 가장 정리됩니다.",
      content:
        "## 매주 금요일\n\n매주 금요일 오전에 1:1 멘토링을 합니다. 이게 어떻게 시작됐는지, 그리고 왜 계속하고 있는지에 대해 짧게 적어봤어요.\n\n남에게 무언가를 설명할 때 내 머릿속이 가장 깔끔해진다는 걸 매번 느낍니다.",
    },
    {
      title: "프로덕트 디자이너에게 쓸모있는 도구 5개",
      excerpt: "지난 한 해 동안 정말 매일 열어본 도구만 골랐어요.",
      content: "1. Linear\n2. Notion\n3. Figma\n4. Loom\n5. iA Writer\n\n각각의 이유는 글에서…",
    },
  ],
  junho: [
    {
      title: "주말 클라이밍 가는 사람을 찾는 방법",
      excerpt: "혼자 가도 좋지만 같이 가면 더 멀리 가게 돼요.",
      content: "토요일 오전 9시, 강북 클라이밍짐. 동행권 슬롯을 열어두었어요.",
    },
  ],
  sora: [
    {
      title: "매주 무료 커피챗을 여는 게 마케팅이라고?",
      excerpt: "사람들과의 대화가 결국 가장 좋은 시장조사입니다.",
      content: "사람들과 직접 만나서 듣는 한 마디가 분기 리서치보다 가치가 큽니다.",
    },
    {
      title: "글쓰기 루틴: 매일 30분",
      excerpt: "30분만 쓰면 된다는 마음으로 시작하면 평균 70분을 씁니다.",
      content: "장기 루틴은 짧게 잡는 게 핵심이에요.",
    },
    {
      title: "이번 주 읽은 책",
      excerpt: "Designing Your Life — 다시 한번.",
      content: "두 번째로 읽었는데도 새로운 챕터가 보였어요.",
    },
  ],
  daeun: [
    {
      title: "글쓰기 클럽 시즌 3, 모집합니다",
      excerpt: "5명, 4주, 매주 화요일 저녁.",
      content: "이번 시즌은 에세이 중심으로 진행해요.",
    },
  ],
  theo: [
    {
      title: "Pop-up Tasting #4: 봄나물 코스",
      excerpt: "이번 토요일 오후, 8명 한정 자리.",
      content: "신선한 봄나물을 소량 코스로 풀어봅니다. 와인 페어링 포함.",
    },
  ],
};

// Slot factory helpers ------------------------------------------------------

const startOfWeek = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
})();

function dayAt(dayOffsetFromMonday, hour, minute = 0) {
  const d = new Date(startOfWeek);
  d.setDate(startOfWeek.getDate() + dayOffsetFromMonday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const SLOTS = {
  mina: [
    {
      title: "30분 1:1 프로덕트 멘토링",
      description: "이력서/포트폴리오 리뷰, 커리어 고민, 디자인 결정 같이 풀어요.",
      duration_min: 30,
      price_cents: 3000000, // 30,000원
      slot_type: "1on1",
      location_detail: "Zoom",
      windows: [dayAt(1, 14), dayAt(1, 15), dayAt(3, 16), dayAt(4, 11)],
    },
  ],
  junho: [
    {
      title: "주말 클라이밍 동행",
      description: "강북 더클라임짐, 같이 가서 2시간. 처음이어도 OK.",
      duration_min: 120,
      price_cents: 2000000,
      slot_type: "companion",
      location_detail: "더클라임 강북점",
      windows: [dayAt(5, 9)],
    },
  ],
  sora: [
    {
      title: "20분 무료 커피챗",
      description: "마케팅, 커리어, 일과 삶의 균형. 가벼운 대화 환영.",
      duration_min: 20,
      price_cents: 0,
      slot_type: "1on1",
      location_detail: "성수 카페 / Zoom",
      windows: [dayAt(2, 11), dayAt(2, 12), dayAt(4, 17)],
    },
  ],
  daeun: [
    {
      title: "글쓰기 클럽 시즌 3 (4주)",
      description: "5명 한정. 매주 화요일 저녁 7시, 4주.",
      duration_min: 120,
      price_cents: 12000000,
      slot_type: "group",
      location_detail: "을지로 작업실",
      windows: [dayAt(1, 19)],
    },
  ],
  theo: [
    {
      title: "Pop-up Tasting #4: 봄나물 코스",
      description: "8명 한정. 5코스 + 와인 페어링.",
      duration_min: 180,
      price_cents: 12000000,
      slot_type: "group",
      location_detail: "한남동 키친",
      windows: [dayAt(5, 18, 30)],
    },
  ],
};

const FOLLOW_GRAPH = [
  // [follower, following]
  ["leo", "mina"],
  ["leo", "junho"],
  ["leo", "sora"],
  ["leo", "daeun"],
  ["leo", "theo"],
  ["mina", "leo"],
  ["mina", "sora"],
  ["junho", "leo"],
  ["sora", "mina"],
  ["sora", "daeun"],
  ["daeun", "sora"],
  ["theo", "mina"],
];

// Slug helper
function slugify(t) {
  const base = t
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "slot"}-${suffix}`;
}

// --- run ---
async function main() {
  const usernames = USERS.map((u) => u.username);
  console.log("Cleaning previous demo users:", usernames.join(", "));
  const { error: delErr } = await db.from("users").delete().in("username", usernames);
  if (delErr) console.warn("(delete) ", delErr.message);

  // Create users
  const idByUsername = new Map();
  for (const u of USERS) {
    const { error } = await db.rpc("create_user", {
      p_username: u.username,
      p_password: PASSWORD,
      p_display_name: u.display_name,
    });
    if (error) throw new Error(`create_user(${u.username}): ${error.message}`);

    const { data: row } = await db
      .from("users")
      .select("id")
      .eq("username", u.username)
      .single();
    idByUsername.set(u.username, row.id);

    await db
      .from("users")
      .update({ bio: u.bio, interests: u.interests })
      .eq("id", row.id);
    console.log("✓ user", u.username);
  }

  // Resolve leo's id (existing) for follows
  {
    const { data } = await db
      .from("users")
      .select("id")
      .eq("username", "leo")
      .single();
    if (data) idByUsername.set("leo", data.id);
  }

  // Posts
  for (const [username, posts] of Object.entries(POSTS)) {
    const userId = idByUsername.get(username);
    for (const p of posts) {
      const slug = slugify(p.title);
      const { error } = await db.from("blog_posts").insert({
        user_id: userId,
        slug,
        title: p.title,
        content: p.content,
        excerpt: p.excerpt,
        published: true,
        published_at: new Date(
          Date.now() - Math.floor(Math.random() * 10) * 24 * 3600 * 1000,
        ).toISOString(),
      });
      if (error) console.warn("post", username, p.title, error.message);
    }
    console.log(`  ${posts.length} posts for ${username}`);
  }

  // Slots + availabilities
  for (const [username, slots] of Object.entries(SLOTS)) {
    const userId = idByUsername.get(username);
    for (const s of slots) {
      const slug = slugify(s.title);
      const { data: slot, error } = await db
        .from("time_slots")
        .insert({
          host_id: userId,
          slug,
          title: s.title,
          description: s.description,
          duration_min: s.duration_min,
          price_cents: s.price_cents,
          capacity: 1,
          slot_type: s.slot_type,
          location_detail: s.location_detail,
          active: true,
          mode: "manual",
        })
        .select("id")
        .single();
      if (error) {
        console.warn("slot", username, s.title, error.message);
        continue;
      }
      const rows = s.windows.map((w) => ({
        slot_id: slot.id,
        start_at: w,
        capacity: 1,
      }));
      await db.from("slot_availabilities").insert(rows);
    }
    console.log(`  ${slots.length} slot(s) for ${username}`);
  }

  // Follows
  for (const [follower, following] of FOLLOW_GRAPH) {
    const fId = idByUsername.get(follower);
    const tId = idByUsername.get(following);
    if (!fId || !tId) continue;
    const { error } = await db
      .from("follows")
      .upsert({ follower_id: fId, following_id: tId }, { onConflict: "follower_id,following_id" });
    if (error) console.warn("follow", follower, "->", following, error.message);
  }
  console.log(`✓ ${FOLLOW_GRAPH.length} follow edges`);

  // A few reactions
  const REACTIONS = [
    ["leo", "post", "magic"], // we patch below: by latest post per author
  ];
  // Add 2-3 random reactions: leo on each user's most recent post and slot
  for (const u of USERS) {
    const userId = idByUsername.get(u.username);
    const leoId = idByUsername.get("leo");
    if (!userId || !leoId) continue;

    const { data: lastPost } = await db
      .from("blog_posts")
      .select("id")
      .eq("user_id", userId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastPost) {
      await db.from("reactions").upsert(
        {
          user_id: leoId,
          target_type: "post",
          target_id: lastPost.id,
          emoji: "❤️",
        },
        { onConflict: "user_id,target_type,target_id,emoji" },
      );
    }
    const { data: lastSlot } = await db
      .from("time_slots")
      .select("id")
      .eq("host_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSlot) {
      await db.from("reactions").upsert(
        {
          user_id: leoId,
          target_type: "slot",
          target_id: lastSlot.id,
          emoji: "🔥",
        },
        { onConflict: "user_id,target_type,target_id,emoji" },
      );
    }
  }
  console.log("✓ seeded a handful of reactions");

  console.log("\n🎉 Done. Test accounts (password: demo1234):");
  for (const u of USERS) console.log(`  /${u.username}  →  ${u.display_name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
