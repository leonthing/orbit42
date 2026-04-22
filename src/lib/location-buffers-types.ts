// Shared types + pure matching logic for location-aware travel buffers.
// Kept free of server-only imports so it can be used inside slot
// availability + the client settings form.

export type LocationBuffer = {
  id: string;
  name: string;
  buffer_min: number;
  aliases: string[];
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve a travel buffer for a given event. Matches the event's
 * location (preferred) and title against each preset's name + aliases.
 * Longest-keyword match wins (so "강남역" beats "강남" if both exist).
 * Returns null when nothing matches.
 */
export function resolveBufferForEvent(
  presets: LocationBuffer[],
  signals: { location?: string | null; title?: string | null },
): LocationBuffer | null {
  const hay = [signals.location, signals.title]
    .filter(Boolean)
    .map((s) => normalize(s as string))
    .join(" | ");
  if (!hay) return null;
  let best: { preset: LocationBuffer; kwLen: number } | null = null;
  for (const p of presets) {
    const keywords = [p.name, ...(p.aliases ?? [])]
      .map(normalize)
      .filter(Boolean);
    for (const kw of keywords) {
      if (hay.includes(kw)) {
        if (!best || kw.length > best.kwLen) {
          best = { preset: p, kwLen: kw.length };
        }
      }
    }
  }
  return best?.preset ?? null;
}
