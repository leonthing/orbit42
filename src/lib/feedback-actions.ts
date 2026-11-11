"use server";

// 클라이언트가 부르는 서버 액션만 여기서 낸다 — @/lib/feedback 는 일반 서버 모듈(보안-6).
import * as impl from "@/lib/feedback";

export async function submitFeedback(...args: Parameters<typeof impl.submitFeedback>) {
  return impl.submitFeedback(...args);
}

export async function toggleFeedbackResolved(...args: Parameters<typeof impl.toggleFeedbackResolved>) {
  return impl.toggleFeedbackResolved(...args);
}
