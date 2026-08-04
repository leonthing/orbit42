/**
 * Canonical event key used by completion marks so month/week views stay
 * in sync even though each view receives events in a different id format.
 *
 * Inputs we need to normalize:
 *   - Month view local:   bare UUID (from `getEvents`)
 *   - Month view google:  `gcal_${itemId}` (from `getEvents`)
 *   - Week view native:   `native:${uuid}` (from `getPublicEvents`)
 *   - Week view google:   `${googleCalendarId}::${itemId}` (from `getPublicEvents`)
 */
/**
 * The client-side event id used by rows we hang off an event
 * (자산 분류 · 참석자): bare uuid for native, `gcal_<id>` for Google.
 * iOS sends the same shape, so both clients address the same row.
 */
export function toEventKey(raw: string): string {
  if (raw.startsWith("native:")) return raw.slice("native:".length);
  // 주간 상세에서 넘어온 합성 id — `gcal:<캘린더>::<이벤트>`
  const body = raw.startsWith("gcal:") ? raw.slice("gcal:".length) : raw;
  const sep = body.indexOf("::");
  if (sep >= 0) return `gcal_${body.slice(sep + 2)}`;
  return body;
}

export function normalizeEventKey(id: string): string {
  if (!id) return id;
  if (id.startsWith("native:")) return `local:${id.slice("native:".length)}`;
  if (id.startsWith("gcal_")) return `google:${id.slice("gcal_".length)}`;
  const sep = id.indexOf("::");
  if (sep > 0) return `google:${id.slice(sep + 2)}`;
  return `local:${id}`;
}
