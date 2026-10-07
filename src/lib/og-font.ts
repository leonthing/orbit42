/**
 * next/og(satori)용 한글 폰트 — Google Fonts 에서 쓰는 글자만 받아 온다.
 * satori 는 woff2·가변 폰트를 못 읽어서 옛 Safari UA 로 일반 TTF 를 받는다.
 */
export async function loadKoreanFont(text: string, weight: 700 | 900 = 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10",
        },
      },
    ).then((r) => r.text());
    const src = css.match(/src:\s*url\(([^)]+)\)/);
    return src ? await fetch(src[1]).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function storyFonts(text: string) {
  const [bold, black] = await Promise.all([loadKoreanFont(text, 700), loadKoreanFont(text, 900)]);
  return [
    ...(bold ? [{ name: "KR", data: bold, weight: 700 as const, style: "normal" as const }] : []),
    ...(black ? [{ name: "KR", data: black, weight: 900 as const, style: "normal" as const }] : []),
  ];
}
