import type { ScannedCardFields } from "./card-ocr-types";

// Server-only: extract structured contact fields from a business-card photo
// using Claude vision. Mirrors the direct-fetch convention in
// blog/social-actions.ts (no SDK, same model + headers).

const MODEL = "claude-3-5-sonnet-20241022";

const PROMPT = `이 이미지는 명함입니다. 명함에서 다음 정보를 정확히 추출해줘.
- 한 사람의 명함이며, 양면이면 두 면의 정보를 합쳐서 판단해.
- 값을 찾을 수 없는 필드는 null 로 둬. 추측하지 마.
- 전화번호는 휴대폰(010 등)을 우선하고, 없으면 대표/사무실 번호를 써. 숫자와 하이픈만 남겨.
- 이메일은 그대로, 회사명은 법인 형태(주식회사 등) 없이 핵심 상호만.

다음 JSON 형식으로만 응답해 (다른 텍스트, 설명, 코드블록 없이):
{
  "name": "이름 (필수)",
  "company": "회사명 또는 null",
  "role": "직책/부서 또는 null",
  "email": "이메일 또는 null",
  "phone": "전화번호 또는 null"
}`;

type RawCardFields = Partial<Record<keyof ScannedCardFields, unknown>>;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

/**
 * Send the card image to Claude vision and return the parsed fields.
 * Returns null when no API key is configured or the model returns no usable
 * text. Throws on a hard API error so the caller can distinguish failures.
 */
export async function extractCardFields(
  base64Data: string,
  mediaType: string,
): Promise<ScannedCardFields | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let raw: RawCardFields;
  try {
    raw = JSON.parse(jsonMatch[0]) as RawCardFields;
  } catch {
    return null;
  }

  const name = clean(raw.name);
  if (!name) return null;

  return {
    name,
    company: clean(raw.company),
    role: clean(raw.role),
    email: clean(raw.email),
    phone: clean(raw.phone),
  };
}
