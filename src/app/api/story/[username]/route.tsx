import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getProfile } from "@/lib/auth";
import { listPublicSlotsByUsername } from "@/lib/slots";
import { storyTemplate } from "@/lib/story-templates";
import { SITE } from "@/lib/constants";
import { storyFonts } from "@/lib/og-font";
import { getAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * 인스타 스토리용 프로필 이미지 (1080×1920 PNG).
 *   /api/story/{username}?t=indigo|sunset|forest|paper|midnight
 * 공개 링크 페이지에 이미 보이는 정보만 쓴다. 비공개 계정은 만들지 않는다.
 */
export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  const profile = await getProfile(params.username);
  if (!profile) return new Response("Not found", { status: 404 });
  const { data: priv } = await getAdminClient()
    .from("users")
    .select("is_private")
    .eq("username", params.username)
    .single();
  if ((priv as { is_private: boolean | null } | null)?.is_private) {
    return new Response("Not found", { status: 404 });
  }

  const t = storyTemplate(request.nextUrl.searchParams.get("t"));
  const slots = (await listPublicSlotsByUsername(params.username))
    .filter((s) => s.pricing_model !== "auction")
    .slice(0, 3);
  const name = (profile.display_name as string | null) || profile.username;
  const bio = ((profile.bio as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 70);
  const interests = ((profile.interests as string[] | null) ?? []).slice(0, 3);
  const url = `${SITE.url}/${profile.username}`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  const headline = "DM 대신, 링크로 시간을 예약하세요";
  const priceOf = (c: number) => (c > 0 ? `₩${Math.round(c / 100).toLocaleString("ko-KR")}` : "무료");

  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
    color: { dark: t.qrDark, light: t.qrLight },
  });
  const allText =
    name + profile.username + bio + interests.join("") + headline + shortUrl +
    slots.map((s) => s.title + s.duration_min + priceOf(s.price_cents)).join("") +
    "@열어 둔 시간분·orbit42 링크로 예약받기→";
  const fonts = await storyFonts(allText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%)`,
          fontFamily: "KR",
          color: t.text,
          padding: "240px 90px 360px",
        }}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url as string}
            width={220}
            height={220}
            style={{ borderRadius: 110, objectFit: "cover", border: `6px solid ${t.accent}` }}
            alt=""
          />
        ) : (
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 110,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: t.pillBg,
              color: t.pillText,
              fontSize: 100,
              fontWeight: 900,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 76, fontWeight: 900, marginTop: 40, letterSpacing: -1 }}>{name}</div>
        <div style={{ fontSize: 34, color: t.sub, marginTop: 6 }}>{`@${profile.username}`}</div>
        {bio && (
          <div style={{ fontSize: 34, fontWeight: 700, color: t.sub, marginTop: 28, textAlign: "center", lineHeight: 1.4 }}>
            {bio}
          </div>
        )}
        {interests.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
            {interests.map((i) => (
              <div
                key={i}
                style={{ display: "flex", fontSize: 28, fontWeight: 700, padding: "10px 26px", borderRadius: 999, border: `2px solid ${t.accent}` }}
              >
                {i}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 46, fontWeight: 900, marginTop: 64, textAlign: "center" }}>{headline}</div>

        {slots.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 34, gap: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.sub }}>열어 둔 시간</div>
            {slots.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "24px 32px",
                  borderRadius: 28,
                  background: "rgba(255,255,255,0.14)",
                  border: `2px solid ${t.accent}`,
                }}
              >
                <div style={{ fontSize: 34, fontWeight: 700, maxWidth: 620, overflow: "hidden" }}>{s.title}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: t.sub }}>
                  {`${s.duration_min}분 · ${priceOf(s.price_cents)}`}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 32, width: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={200} height={200} style={{ borderRadius: 18 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 42,
                fontWeight: 900,
                padding: "16px 40px",
                borderRadius: 999,
                background: t.pillBg,
                color: t.pillText,
              }}
            >
              예약하기 →
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: t.sub }}>{shortUrl}</div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 28, fontWeight: 700, color: t.sub }}>
          orbit42 · 링크로 예약받기
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
