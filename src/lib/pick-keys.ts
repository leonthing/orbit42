/**
 * 서버 액션·API 가 받은 객체에서 허용한 칸만 남긴다(보안-7).
 * 서버 액션은 TypeScript 타입과 상관없이 아무 JSON 이나 받으므로, update 에 그대로 펼치면
 * user_id 같은 칸까지 바뀐다. undefined 인 칸은 뺀다.
 */
export function pickKeys<T extends object, K extends string>(input: unknown, keys: readonly K[]): Partial<T> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out as Partial<T>;
}
