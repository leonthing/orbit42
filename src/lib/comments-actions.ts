"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/comments 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/comments";

export async function addComment(...args: Parameters<typeof impl.addComment>) {
  return impl.addComment(...args);
}

export async function deleteComment(...args: Parameters<typeof impl.deleteComment>) {
  return impl.deleteComment(...args);
}

export async function listComments(...args: Parameters<typeof impl.listComments>) {
  return impl.listComments(...args);
}
