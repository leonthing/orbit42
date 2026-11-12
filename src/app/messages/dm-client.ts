/** 웹 1:1 대화 화면이 부르는 API (/api/v1/dm, 쿠키 로그인) */
export async function dmAction(id: string, action: string, extra: Record<string, unknown> = {}): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/v1/dm/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    return { error: "연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요." };
  }
}
