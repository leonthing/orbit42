"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/blog-media 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/blog-media";

export async function uploadBlogImage(...args: Parameters<typeof impl.uploadBlogImage>) {
  return impl.uploadBlogImage(...args);
}
