import type { calendar_v3 } from "googleapis";

/**
 * 종일↔시간 전환 바디(반대쪽 칸 null)는 '실제로 바뀔 때만' 보낸다(11/22 PO).
 * iOS 1.11.0 이 allDay 를 늘 보내면서 종일→종일 날짜 변경에도 dateTime·timeZone null 이 실렸다 —
 * 지금 구글 일정(수정 전에 이미 읽는 값)과 같은 종류면 null 칸을 뺀다. 읽지 못했으면(item null) 그대로 둔다.
 */
export function onlySwitchNulls(body: calendar_v3.Schema$Event, item: calendar_v3.Schema$Event | null): calendar_v3.Schema$Event {
  if (!item) return body;
  const wasAllDay = !!item.start?.date;
  for (const k of ["start", "end"] as const) {
    const v = body[k];
    if (!v) continue;
    const nowAllDay = v.date != null;
    if (nowAllDay !== wasAllDay) continue; // 실제 전환 — null 로 반대쪽을 비워야 구글이 받는다
    body[k] = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)) as calendar_v3.Schema$EventDateTime;
  }
  return body;
}
