"use server";

import { requireUserId } from "@/lib/db";
import { getSocialStatus, postToX, postToFacebook, postToLinkedIn } from "@/lib/social";

export interface SocialPosts {
  x: string;
  facebook: string;
  linkedin: string;
}

export async function generateSocialPosts(
  title: string,
  content: string,
  slug: string,
  username: string
): Promise<SocialPosts> {
  const blogUrl = `https://blog.orbit42.org/${username}/${slug}`;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const excerpt = content
    .replace(/[#*_`>\-\[\]()!]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 200);

  const fallback: SocialPosts = {
    x: `${title}\n\n${excerpt}...\n\n${blogUrl}`,
    facebook: `${title}\n\n${excerpt}...\n\n${blogUrl}`,
    linkedin: `${title}\n\n${excerpt}...\n\n${blogUrl}`,
  };

  if (!apiKey) return fallback;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `다음 블로그 글을 소셜 미디어용으로 요약해줘. 반드시 한국어로 작성하고, 각 플랫폼 스타일에 맞게 작성해.

제목: ${title}
URL: ${blogUrl}
본문:
${content.slice(0, 3000)}

다음 JSON 형식으로만 응답해 (다른 텍스트 없이):
{
  "x": "X(트위터)용 포스트 (280자 이내, 해시태그 2-3개 포함, URL 포함)",
  "facebook": "페이스북용 포스트 (자연스럽고 읽기 좋게, URL 포함, 이모지 적절히 사용)",
  "linkedin": "링크드인용 포스트 (전문적이고 인사이트 중심, URL 포함, 해시태그 3-5개)"
}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SocialPosts;
    }
  } catch (e) {
    console.error("AI summary generation failed:", e);
  }

  return fallback;
}

export async function getSocialConnectionStatus() {
  const userId = await requireUserId();
  const status = await getSocialStatus(userId);
  return {
    ...status,
    configured: {
      x: !!process.env.X_CLIENT_ID,
      facebook: !!process.env.FACEBOOK_APP_ID,
      linkedin: !!process.env.LINKEDIN_CLIENT_ID,
    },
  };
}

export async function publishToX(text: string) {
  const userId = await requireUserId();
  return postToX(userId, text);
}

export async function publishToFacebook(message: string, link?: string) {
  const userId = await requireUserId();
  return postToFacebook(userId, message, link);
}

export async function publishToLinkedIn(text: string, articleUrl?: string) {
  const userId = await requireUserId();
  return postToLinkedIn(userId, text, articleUrl);
}
