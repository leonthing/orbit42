// 일반 서버 모듈 — 서버 액션 아님(보안-6).
// 웹 1:1 메시지는 1.9.0 부터 lib/dm.ts(요청·수락·차단·나가기 규칙)를 쓰고, 화면의 동작은 /api/v1/dm 을 부른다.
import { getSession } from "@/lib/auth";
import { unreadDmCount, userIdOf } from "@/lib/dm";

/** 사이드바·하단 메뉴 배지: 안 읽은 1:1 대화 + 받은 요청 (시행일 전 0) */
export async function unreadMessageCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  const me = await userIdOf(session.username);
  return me ? unreadDmCount(me) : 0;
}

/** 서버 컴포넌트에서 로그인한 사람의 id */
export async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  return session ? userIdOf(session.username) : null;
}
