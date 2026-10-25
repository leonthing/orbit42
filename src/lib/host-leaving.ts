import { getAdminClient } from "@/lib/supabase";

// "use server" 파일(account·admin)에 두면 브라우저에서 부를 수 있는 서버 액션이 되므로 일반 서버 모듈에 둔다.
/** 탈퇴·관리자 삭제로 사라지는 호스트의 앞으로 남은 확정·대기 예약 게스트에게 취소 안내 메일 (CEO 10/26). 실패는 로그만. */
export async function notifyGuestsBeforeHostLeaves(hostId: string) {
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("bookings")
      .select("id, guest_id, guest_email, scheduled_at, slot:time_slots!bookings_slot_id_fkey(title)")
      .eq("host_id", hostId)
      .in("status", ["pending", "confirmed"])
      .gt("scheduled_at", new Date().toISOString());
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      guest_id: string | null;
      guest_email: string | null;
      scheduled_at: string;
      slot: { title: string } | null;
    }>;
    if (rows.length === 0) return;
    const { sendHostLeftCancelToGuest } = await import("@/lib/email");
    let sent = 0;
    let failed = 0;
    for (const b of rows) {
      try {
        let to = b.guest_email;
        if (!to && b.guest_id) {
          const { data: g } = await db.from("users").select("email").eq("id", b.guest_id).maybeSingle();
          to = (g?.email as string | null) ?? null;
        }
        if (!to) continue;
        const r = await sendHostLeftCancelToGuest(to, { slotTitle: b.slot?.title ?? "예약", when: b.scheduled_at });
        if (r?.ok === false) failed++;
        else sent++;
      } catch (err) {
        failed++;
        console.error("[account-delete] guest cancel email", b.id, err);
      }
    }
    // 메일 주소·이름은 남기지 않는다
    console.info(`[account-delete] host-left cancel emails sent=${sent} failed=${failed} bookings=${rows.length}`);
  } catch (err) {
    console.error("[account-delete] notify guests", err);
  }
}
