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
export function normalizeEventKey(id: string): string {
  if (!id) return id;
  if (id.startsWith("native:")) return `local:${id.slice("native:".length)}`;
  if (id.startsWith("gcal_")) return `google:${id.slice("gcal_".length)}`;
  const sep = id.indexOf("::");
  if (sep > 0) return `google:${id.slice(sep + 2)}`;
  return `local:${id}`;
}
