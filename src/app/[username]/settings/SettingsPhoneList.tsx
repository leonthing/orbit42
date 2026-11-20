"use client";

// 휴대폰 설정 — iOS 처럼 목록 → 하위 화면(?tab=…). 웹에만 있던 탐색·서비스 메뉴·로그아웃도 여기로(PO 11/21).
// 화면 모드(다크)는 묶음 5에서 켤 때 넣는다.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth-actions";

type Row = { label: string; href: string; sub?: string; external?: boolean; danger?: boolean };

export function SettingsPhoneList({ username, cardsOpen }: { username: string; cardsOpen: boolean }) {
  const router = useRouter();
  const t = (tab: string) => `/${username}/settings?tab=${tab}`;
  const groups: Array<{ title: string; rows: Row[] }> = [
    {
      title: "계정",
      rows: [
        { label: "프로필", href: t("profile"), sub: "사진·이름·소개·관심사·SNS" },
        { label: "계정", href: t("account"), sub: "비밀번호" },
      ],
    },
    {
      title: "캘린더·연결",
      rows: [
        { label: "내 캘린더", href: t("calendars") },
        { label: "Google 캘린더", href: t("google") },
        { label: "근무시간", href: t("work-hours") },
        { label: "이동시간 버퍼", href: t("locations") },
        ...(cardsOpen ? [{ label: "명함 → 구글 연락처 (시험)", href: `/${username}/cards` }] : []),
      ],
    },
    {
      title: "예약 링크",
      rows: [
        { label: "결제 안내 (계좌이체)", href: t("payment") },
        { label: "서비스 메뉴", href: `/${username}/services`, sub: "예약에 붙이는 추가 메뉴" },
        { label: "공개 링크 테마", href: t("link-theme") },
      ],
    },
    {
      title: "알림",
      rows: [{ label: "알림 설정", href: t("notifications") }],
    },
    {
      title: "정보·지원",
      rows: [
        { label: "탐색", href: "/explore", sub: "다른 사람들의 열린 시간" },
        { label: "친구 초대", href: t("referral") },
        { label: "연동 토큰", href: t("integrations"), sub: "CEO 세션 등 다른 도구 연결" },
        { label: "이용약관", href: "/terms", external: true },
        { label: "개인정보처리방침", href: "/privacy", external: true },
        { label: "계정 삭제", href: t("danger"), danger: true },
      ],
    },
  ];
  return (
    <div className="space-y-5 md:hidden" data-testid="settingsPhoneList">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-1.5 px-1 text-xs font-semibold text-charcoal-500">{g.title}</h2>
          <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-2xl bg-[rgb(var(--bg-surface))]">
            {g.rows.map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${r.danger ? "text-red-500" : "text-charcoal-100"}`}>{r.label}</span>
                    {r.sub && <span className="block truncate text-xs text-charcoal-500">{r.sub}</span>}
                  </span>
                  <span aria-hidden className="text-charcoal-500">{r.external ? "↗" : "›"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="min-h-12 w-full rounded-2xl bg-[rgb(var(--bg-surface))] px-4 text-sm font-medium text-red-500"
      >
        로그아웃
      </button>
    </div>
  );
}
