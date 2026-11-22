/**
 * OG 그림 왼쪽 위 로고 — 앱 아이콘 A(11/22 Leo 확정)와 같은 모양.
 * 1024 원본 기준: 궤도 고리 중심 반지름 315·굵기 56, 안쪽 점 12개(반지름 35, 중심에서 210.5, 30°마다).
 * 바탕 #F2F2F7 · 색 #4F46E5(라이트 아이콘). 옛 빨간 'O' 상자를 대신한다.
 */
export function OgLogo({ size = 48 }: { size?: number }) {
  const dots = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return { cx: 512 + 210.5 * Math.cos(a), cy: 512 + 210.5 * Math.sin(a) };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024">
      <rect x="0" y="0" width="1024" height="1024" rx="230" fill="#F2F2F7" />
      <circle cx="512" cy="512" r="315" fill="none" stroke="#4F46E5" strokeWidth="56" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="35" fill="#4F46E5" />
      ))}
    </svg>
  );
}
