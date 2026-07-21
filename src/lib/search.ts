"use server";

import { getAdminClient } from "@/lib/supabase";

export type SearchResult = {
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  }[];
  slots: {
    id: string;
    slug: string;
    title: string;
    host: { username: string; display_name: string | null; avatar_url: string | null };
    price_cents: number;
    pricing_model: "fixed" | "auction";
    reserve_price_cents: number | null;
    duration_min: number;
  }[];
};

export async function searchAll(q: string): Promise<SearchResult> {
  const query = q.trim();
  if (query.length < 1) return { users: [], slots: [] };
  const db = getAdminClient();

  // Strip both LIKE wildcards (%_) and PostgREST-structural characters (,()
  // and the field.op.value separator `.`) so a crafted query cannot inject
  // extra filter clauses into the `.or(...)` grammar below.
  const pattern = `%${query.replace(/[%_,().]/g, "")}%`;

  const [usersRes, slotsRes] = await Promise.all([
    db
      .from("users")
      .select("username, display_name, avatar_url, bio")
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(20),
    db
      .from("time_slots")
      .select(
        "id, slug, title, host_id, price_cents, pricing_model, reserve_price_cents, duration_min, active",
      )
      .ilike("title", pattern)
      .eq("active", true)
      .limit(20),
  ]);

  const users = (usersRes.data ?? []).map((u) => ({
    username: u.username as string,
    display_name: (u.display_name as string | null) ?? null,
    avatar_url: (u.avatar_url as string | null) ?? null,
    bio: (u.bio as string | null) ?? null,
  }));

  // Resolve slot hosts.
  const hostIds = Array.from(
    new Set((slotsRes.data ?? []).map((s) => s.host_id as string)),
  );
  const hostMap = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (hostIds.length > 0) {
    const { data: hosts } = await db
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", hostIds);
    for (const h of hosts ?? []) {
      hostMap.set(h.id as string, {
        username: h.username as string,
        display_name: (h.display_name as string | null) ?? null,
        avatar_url: (h.avatar_url as string | null) ?? null,
      });
    }
  }

  const slots = (slotsRes.data ?? [])
    .map((s) => {
      const host = hostMap.get(s.host_id as string);
      if (!host) return null;
      return {
        id: s.id as string,
        slug: s.slug as string,
        title: s.title as string,
        host,
        price_cents: (s.price_cents as number) ?? 0,
        pricing_model: s.pricing_model as "fixed" | "auction",
        reserve_price_cents:
          (s.reserve_price_cents as number | null) ?? null,
        duration_min: (s.duration_min as number) ?? 30,
      };
    })
    .filter(Boolean) as SearchResult["slots"];

  return { users, slots };
}
