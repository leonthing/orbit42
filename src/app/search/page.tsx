import Link from "next/link";
import { searchAll } from "@/lib/search";
import { Avatar } from "@/components/Avatar";
import { SearchInput } from "./SearchInput";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const result = q ? await searchAll(q) : { users: [], slots: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-charcoal-100">검색</h1>
        <p className="mt-0.5 text-xs text-charcoal-500">
          사람 · 슬롯 이름으로 찾아보세요
        </p>
      </div>

      <SearchInput initialQuery={q} />

      {q && (
        <>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal-500">
              사람 ({result.users.length})
            </h2>
            {result.users.length === 0 ? (
              <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 p-4 text-sm text-charcoal-500">
                일치하는 사람이 없어요.
              </p>
            ) : (
              <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
                {result.users.map((u) => (
                  <li key={u.username}>
                    <Link
                      href={`/${u.username}`}
                      className="flex items-start gap-3 p-3 hover:bg-charcoal-800/40"
                    >
                      <Avatar
                        url={u.avatar_url}
                        name={u.display_name || u.username}
                        size={40}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-charcoal-100">
                          {u.display_name || u.username}
                        </p>
                        <p className="truncate text-xs text-charcoal-500">
                          @{u.username}
                        </p>
                        {u.bio && (
                          <p className="mt-1 line-clamp-2 text-xs text-charcoal-400">
                            {u.bio}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal-500">
              슬롯 ({result.slots.length})
            </h2>
            {result.slots.length === 0 ? (
              <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 p-4 text-sm text-charcoal-500">
                일치하는 슬롯이 없어요.
              </p>
            ) : (
              <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
                {result.slots.map((s) => {
                  const priceLabel =
                    s.pricing_model === "auction"
                      ? `경매 · 시작가 ₩${((s.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
                      : s.price_cents === 0
                        ? "FREE"
                        : `₩${(s.price_cents / 100).toLocaleString("ko-KR")}`;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/${s.host.username}/s/${s.slug}`}
                        className="flex items-start gap-3 p-3 hover:bg-charcoal-800/40"
                      >
                        <Avatar
                          url={s.host.avatar_url}
                          name={s.host.display_name || s.host.username}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-charcoal-100">
                            {s.title}
                          </p>
                          <p className="truncate text-xs text-charcoal-500">
                            @{s.host.username} · {s.duration_min}분 ·{" "}
                            {priceLabel}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
