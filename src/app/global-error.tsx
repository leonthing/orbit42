"use client";

import { useEffect } from "react";

// global-error replaces the root layout, so it must render its own
// <html>/<body>. This only fires when the root layout itself throws —
// the last line of defense before a blank white screen.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',Roboto,'Segoe UI',sans-serif",
          background: "#0a0a0a",
          color: "#e4e4e7",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>
            일시적인 오류가 발생했어요
          </h1>
          <p style={{ marginTop: "12px", color: "#a1a1aa" }}>
            잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "24px",
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#fafafa",
              color: "#0a0a0a",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
