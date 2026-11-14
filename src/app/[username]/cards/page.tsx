import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { cardsOpenFor } from "@/lib/cards-access";
import { cardStatus } from "@/lib/cards-google";
import { CardsConnectPanel } from "./CardsConnectPanel";

/** 허용 계정이 아니면 제목에도 기능 이름을 드러내지 않는다 */
export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const s = await getSession();
  let open = false;
  if (s && s.username === params.username) {
    const { data } = await getAdminClient().from("users").select("id").eq("username", s.username).single();
    open = !!data && cardsOpenFor(data.id as string);
  }
  return { title: open ? "명함 → 구글 연락처" : "orbit42", robots: { index: false } };
}
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing_scopes: "연락처·Drive 권한이 모두 허용되지 않아 연결하지 않았어요. 다시 연결하면서 Google 화면의 항목을 모두 체크해 주세요.",
  access_denied: "Google 화면에서 취소했어요.",
  admin_policy_enforced: "회사(Workspace) 관리자 설정 때문에 Google이 이 권한을 막았어요.",
  no_refresh: "Google이 오래 쓸 수 있는 연결을 주지 않았어요. 다시 연결해 주세요.",
};

/** 1차(Leo 전용): 웹은 연결·해제·상태만. 명함 등록은 iOS 앱에서 */
export default async function CardsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams?: { connected?: string; error?: string };
}) {
  const s = await getSession();
  if (!s || s.username !== params.username) notFound();
  const { data } = await getAdminClient().from("users").select("id").eq("username", s.username).single();
  if (!data || !cardsOpenFor(data.id as string)) notFound();
  const st = await cardStatus(data.id as string);
  const err = searchParams?.error;
  return (
    <div className="w-full min-w-0 max-w-2xl max-md:pb-[var(--mobile-nav-pb)]">
      <h1 className="text-2xl font-bold text-charcoal-100 max-md:text-xl">명함 → 구글 연락처</h1>
      <p className="mt-1 text-sm text-charcoal-500">시험 기능 · 내 계정에만 보여요</p>
      {searchParams?.connected && st.connected && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          연결했어요. 이제 iOS 앱에서 명함을 찍어 등록할 수 있어요.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {ERRORS[err] ?? "Google 연결에 실패했어요. 잠시 후 다시 해 주세요."}
        </p>
      )}
      <CardsConnectPanel connected={st.connected} email={st.email} />
    </div>
  );
}
