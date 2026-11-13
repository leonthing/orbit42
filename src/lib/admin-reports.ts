// 일반 서버 모듈 — 서버 액션 아님(보안-6). 클라이언트용은 admin-actions.ts
// 운영자 신고 목록·처리(예약 대화 + 1:1 대화). 24시간 안 처리가 목표(가이드라인 1.2).
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase";

export type ReportAction = "block" | "hide" | "ignore";
export const REPORT_ACTIONS: ReportAction[] = ["block", "hide", "ignore"];

export type SnapshotLine = { role: string; at: string; body: string; reported: boolean };

export type AdminReport = {
  id: string;
  kind: "dm" | "booking";
  createdAt: string;
  handledAt: string | null;
  action: ReportAction | null;
  handledBy: string | null;
  reason: string | null;
  reporter: { id: string | null; username: string | null };
  reported: { id: string | null; username: string | null };
  /** 신고된 메시지가 아직 남아 있는지(숨김 가능 여부) */
  messageLive: boolean;
  lines: SnapshotLine[];
};

type Row = {
  id: string;
  booking_id: string | null;
  message_id: string | null;
  conversation_id: string | null;
  dm_message_id: string | null;
  reporter_role: string;
  reporter_id: string | null;
  reason: string | null;
  body_snapshot: string | null;
  created_at: string;
  handled_at: string | null;
  action: string | null;
  handled_by: string | null;
};

/** 사본: 1:1 은 {reportedUserId, messages}, 예약 대화는 배열(역할 host/guest) */
export function parseSnapshot(raw: string | null): { reportedUserId: string | null; lines: SnapshotLine[] } {
  if (!raw) return { reportedUserId: null, lines: [] };
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return { reportedUserId: null, lines: v as SnapshotLine[] };
    const o = v as { reportedUserId?: string; messages?: SnapshotLine[] };
    return { reportedUserId: o.reportedUserId ?? null, lines: o.messages ?? [] };
  } catch {
    return { reportedUserId: null, lines: [] };
  }
}

async function reportedOfBooking(bookingId: string | null, reporterRole: string): Promise<string | null> {
  if (!bookingId) return null;
  const { data } = await getAdminClient().from("bookings").select("host_id, guest_id").eq("id", bookingId).maybeSingle();
  if (!data) return null;
  return ((reporterRole === "host" ? data.guest_id : data.host_id) as string | null) ?? null;
}

export async function listReports(): Promise<AdminReport[] | null> {
  if (!(await requireAdmin())) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("message_reports")
    .select("id, booking_id, message_id, conversation_id, dm_message_id, reporter_role, reporter_id, reason, body_snapshot, created_at, handled_at, action, handled_by")
    .order("handled_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Row[];
  const items = await Promise.all(
    rows.map(async (r) => {
      const snap = parseSnapshot(r.body_snapshot);
      const kind: AdminReport["kind"] = r.conversation_id ? "dm" : "booking";
      const reportedId = kind === "dm" ? snap.reportedUserId : await reportedOfBooking(r.booking_id, r.reporter_role);
      return { r, snap, kind, reportedId };
    }),
  );
  const ids = Array.from(new Set(items.flatMap((i) => [i.r.reporter_id, i.reportedId]).filter((x): x is string => !!x)));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: us } = await db.from("users").select("id, username").in("id", ids);
    for (const u of us ?? []) names.set(u.id as string, u.username as string);
  }
  return items.map(({ r, snap, kind, reportedId }) => ({
    id: r.id,
    kind,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    action: (r.action as ReportAction | null) ?? null,
    handledBy: r.handled_by,
    reason: r.reason,
    reporter: { id: r.reporter_id, username: r.reporter_id ? names.get(r.reporter_id) ?? null : null },
    reported: { id: reportedId, username: reportedId ? names.get(reportedId) ?? null : null },
    messageLive: kind === "dm" ? !!r.dm_message_id : !!r.message_id,
    lines: snap.lines,
  }));
}

export async function openReportCount(): Promise<number> {
  const { count } = await getAdminClient()
    .from("message_reports")
    .select("id", { count: "exact", head: true })
    .is("handled_at", null);
  return count ?? 0;
}

/**
 * 처리: block = 신고자 쪽에서 신고된 사람을 차단(앱의 차단과 같음: 대화·예약 막힘, 팔로우 양쪽 해제)
 *       hide  = 신고된 메시지를 지운다(양쪽 화면에서 사라짐, 신고 사본은 남음)
 *       ignore = 조치 없이 처리 완료
 */
export async function handleReport(id: string, action: ReportAction): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };
  if (!REPORT_ACTIONS.includes(action)) return { error: "잘못된 처리예요." };
  const db = getAdminClient();
  const { data } = await db
    .from("message_reports")
    .select("id, booking_id, message_id, conversation_id, dm_message_id, reporter_role, reporter_id, body_snapshot")
    .eq("id", id)
    .maybeSingle();
  const r = data as Row | null;
  if (!r) return { error: "신고를 찾을 수 없어요." };

  if (action === "block") {
    const reported = r.conversation_id ? parseSnapshot(r.body_snapshot).reportedUserId : await reportedOfBooking(r.booking_id, r.reporter_role);
    if (!r.reporter_id || !reported) return { error: "신고자나 신고된 사람이 이미 없어요. 무시로 처리해 주세요." };
    await db.from("user_blocks").upsert({ blocker_id: r.reporter_id, blocked_id: reported }, { onConflict: "blocker_id,blocked_id" });
    await db.from("follows").delete().match({ follower_id: r.reporter_id, following_id: reported });
    await db.from("follows").delete().match({ follower_id: reported, following_id: r.reporter_id });
  } else if (action === "hide") {
    if (r.conversation_id && r.dm_message_id) {
      await db.from("messages").delete().eq("id", r.dm_message_id);
      // 목록 미리보기가 지운 글이면 남은 마지막 글로 바꾼다
      const { data: last } = await db
        .from("messages")
        .select("body, created_at, sender_id")
        .eq("conversation_id", r.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1);
      const m = last?.[0];
      await db
        .from("conversations")
        .update({
          last_message_preview: m ? String(m.body).slice(0, 200) : null,
          last_message_at: m ? m.created_at : null,
          last_sender_id: m ? m.sender_id : null,
        })
        .eq("id", r.conversation_id);
    } else if (r.message_id) {
      await db.from("booking_messages").delete().eq("id", r.message_id);
    } else {
      return { error: "메시지가 이미 지워졌어요. 무시로 처리해 주세요." };
    }
  }

  const { error } = await db
    .from("message_reports")
    .update({ handled_at: new Date().toISOString(), action, handled_by: admin.username })
    .eq("id", id);
  if (error) return { error: "처리를 저장하지 못했어요." };
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}
