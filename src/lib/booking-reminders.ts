import { getAdminClient } from "@/lib/supabase";
import { sendBookingReminderEmail } from "@/lib/email";
import { emailAllowed } from "@/lib/notification-prefs";
import { createNotification } from "@/lib/notifications";
import { ensureManagePath } from "@/lib/guest-manage";

/**
 * 예약 리마인더 — 호스트·게스트 양쪽에 메일 + 앱 알림. 10분마다 돈다. CRON_SECRET 필요.
 *
 * - 24시간 전(`booking_reminder`, reminder_sent_at): 3시간~24시간 뒤 확정 예약.
 *   만든 지 2시간 안 된 예약은 건너뛴다(확인 메일이 막 나갔다).
 * - 1시간 전(`booking_reminder_1h`, reminder_1h_sent_at): 15분~70분 뒤 확정 예약.
 *   시작 2시간 안쪽에 만든 예약은 건너뛴다(확인 메일이 곧 리마인더다).
 *
 * 게스트가 관리 링크에서 리마인더를 끈 예약(guest_reminders_off_at)은 게스트 메일만 건너뛴다(호스트·앱 알림은 그대로).
 * 끈 동안 지난 회차는 보낸 것으로 적혀 다시 켜면 남은 회차부터 간다.
 *
 * 지난·취소된 예약은 status/scheduled_at 조건으로 빠지고, 보낸 시각을 먼저 적어
 * 다시 돌아도 두 번 가지 않는다. 시간이 바뀌면 moveBookingTo 가 두 칸을 다시 정한다.
 */
type Kind = "day" | "hour";

const KINDS: Record<
  Kind,
  { column: "reminder_sent_at" | "reminder_1h_sent_at"; pref: string; fromMin: number; toMin: number }
> = {
  day: { column: "reminder_sent_at", pref: "booking_reminder", fromMin: 3 * 60, toMin: 24 * 60 },
  hour: { column: "reminder_1h_sent_at", pref: "booking_reminder_1h", fromMin: 15, toMin: 70 },
};

type DueBooking = {
  id: string;
  host_id: string;
  guest_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  scheduled_at: string;
  created_at: string;
  selected_location: string | null;
  guest_reminders_off_at: string | null;
  slot: { title: string; location_detail: string | null } | null;
};

/** 두 리마인더를 한 번 돈다. onlyIds 를 주면 그 예약만(테스트용). */
export async function runBookingReminders(
  now: Date = new Date(),
  onlyIds?: string[],
): Promise<Record<Kind, number> | null> {
  const result: Record<Kind, number> = { day: 0, hour: 0 };
  // 운영 스위치 — app_flags.reminders_paused 가 켜져 있으면 보내지 않는다(배포 없이 멈춤)
  if (await remindersPaused()) {
    console.info("[reminder] paused by app_flags.reminders_paused");
    return result;
  }
  for (const kind of ["hour", "day"] as Kind[]) {
    const r = await runKind(kind, now, onlyIds);
    if (r === null) return null;
    result[kind] = r;
  }
  return result;
}

async function remindersPaused(): Promise<boolean> {
  const { data, error } = await getAdminClient()
    .from("app_flags")
    .select("enabled")
    .eq("key", "reminders_paused")
    .maybeSingle();
  if (error) {
    // 스위치를 못 읽으면 평소대로 보낸다(테이블이 없을 때 등) — 기록만 남긴다
    console.error("[reminder] app_flags read", error.message);
    return false;
  }
  return data?.enabled === true;
}

async function runKind(kind: Kind, now: Date, onlyIds?: string[]): Promise<number | null> {
  const cfg = KINDS[kind];
  const db = getAdminClient();
  const from = new Date(now.getTime() + cfg.fromMin * 60_000);
  const to = new Date(now.getTime() + cfg.toMin * 60_000);

  let query = db
    .from("bookings")
    .select(
      "id, host_id, guest_id, guest_name, guest_email, scheduled_at, created_at, selected_location, guest_reminders_off_at, slot:time_slots!bookings_slot_id_fkey(title, location_detail)",
    )
    .eq("status", "confirmed")
    .is(cfg.column, null)
    .gt("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString())
    .limit(200);
  if (onlyIds) query = query.in("id", onlyIds);
  const { data, error } = await query;
  if (error) {
    console.error("reminders cron select", kind, error);
    return null;
  }

  let sent = 0;
  for (const b of (data ?? []) as unknown as DueBooking[]) {
    const start = new Date(b.scheduled_at).getTime();
    const created = new Date(b.created_at).getTime();
    if (kind === "day" && now.getTime() - created < 2 * 60 * 60_000) continue;
    if (kind === "hour" && start - created < 2 * 60 * 60_000) continue;

    // 먼저 적는다 — 다시 돌아도 두 번 보내지 않게.
    const { data: marked, error: markErr } = await db
      .from("bookings")
      .update({ [cfg.column]: new Date().toISOString() })
      .eq("id", b.id)
      .is(cfg.column, null)
      .select("id");
    if (markErr || !marked?.length) continue;

    await sendOne(kind, b, now);
    sent++;
  }
  return sent;
}

/** 서울 날짜 기준 '오늘'/'내일'/'M월 D일' */
function dayWord(iso: string, now: Date): string {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const target = key(new Date(iso));
  if (target === key(now)) return "오늘";
  if (target === key(new Date(now.getTime() + 24 * 60 * 60_000))) return "내일";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
}

async function sendOne(kind: Kind, b: DueBooking, now: Date) {
  const db = getAdminClient();
  const cfg = KINDS[kind];
  const slotTitle = b.slot?.title ?? "예약";
  const location = b.selected_location ?? b.slot?.location_detail ?? null;
  const timeLabel = new Date(b.scheduled_at).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  });
  const lead = kind === "hour" ? "곧" : dayWord(b.scheduled_at, now);

  const [{ data: host }, { data: guest }] = await Promise.all([
    db.from("users").select("email, display_name, username").eq("id", b.host_id).single(),
    b.guest_id
      ? db.from("users").select("email, display_name, username").eq("id", b.guest_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const hostLabel = (host?.display_name || host?.username || "호스트") as string;
  const guestLabel = (b.guest_name || guest?.display_name || guest?.username || "게스트") as string;

  try {
    if (host?.email && (await emailAllowed(b.host_id, cfg.pref))) {
      const r = await sendBookingReminderEmail(host.email as string, {
        kind,
        lead,
        role: "host",
        slotTitle,
        when: b.scheduled_at,
        otherLabel: guestLabel,
        location,
        manageUrl: `/${host.username}/bookings`,
        hasAccount: true,
      });
      logSend(kind, "host", b, r.ok);
    }
    const guestEmail = b.guest_email ?? (guest?.email as string | null) ?? null;
    if (guestEmail && b.guest_reminders_off_at) {
      // 게스트가 관리 링크에서 이 예약의 리마인더를 껐다
      logSkip(kind, b.guest_id ? "guest" : "guest-no-account", b, "guest_off");
    } else if (guestEmail && (await emailAllowed(b.guest_id, cfg.pref))) {
      const r = await sendBookingReminderEmail(guestEmail, {
        kind,
        lead,
        role: "guest",
        slotTitle,
        when: b.scheduled_at,
        otherLabel: hostLabel,
        location,
        // 게스트에게만 관리 링크 — 로그인 없이 보기·취소·시간 바꾸기 (개선-40)
        manageUrl: await ensureManagePath(b.id),
        hasAccount: !!b.guest_id,
      });
      logSend(kind, b.guest_id ? "guest" : "guest-no-account", b, r.ok);
    }
  } catch (err) {
    console.error("reminders cron email", kind, err);
  }

  // 가입한 양쪽에 앱 알림
  const title = kind === "hour" ? `1시간 뒤 예약: ${slotTitle}` : `${lead} 예약: ${slotTitle}`;
  try {
    await createNotification({
      userId: b.host_id,
      type: cfg.pref,
      title,
      body: `${guestLabel} · ${timeLabel}`,
      link: `/${host?.username}/bookings`,
      actorId: null,
    });
    if (b.guest_id) {
      await createNotification({
        userId: b.guest_id,
        type: cfg.pref,
        title,
        body: `${hostLabel} · ${timeLabel}`,
        link: `/bookings`,
        actorId: null,
      });
    }
  } catch (err) {
    console.error("reminders cron notification", kind, err);
  }
}

/** 발송 기록 한 줄 — Vercel 런타임 로그에서 '[reminder] sent' 로 찾는다. 메일 주소는 남기지 않는다. */
function logSend(kind: Kind, to: string, b: DueBooking, ok: boolean) {
  console.info(
    `[reminder] sent kind=${kind === "hour" ? "1h" : "day"} to=${to} ok=${ok} booking=${b.id} start=${b.scheduled_at}`,
  );
}

/** 건너뛴 기록 한 줄 — '[reminder] skipped' 로 찾는다. */
function logSkip(kind: Kind, to: string, b: DueBooking, reason: string) {
  console.info(
    `[reminder] skipped kind=${kind === "hour" ? "1h" : "day"} to=${to} reason=${reason} booking=${b.id} start=${b.scheduled_at}`,
  );
}
